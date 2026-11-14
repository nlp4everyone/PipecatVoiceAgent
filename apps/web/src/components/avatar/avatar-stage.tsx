import {
  type VRM,
  VRMLookAtExpressionApplier,
  VRMLookAtRangeMap,
  VRMUtils,
} from "@pixiv/three-vrm";
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, Mesh, Object3D, type PerspectiveCamera } from "three";
import { AvatarLoader, registerVrm } from "./preload";

import type { OrbState } from "@/components/chat-orb";
import { cn } from "@/lib/utils";

import { useAvatarLipsync, VISEMES } from "./use-avatar-lipsync";
import { fpsOverride, TIERS, type TierConfig, useTier } from "./quality";
import {
  type ExpressionTag,
  MOUTH_JOY_OVERLAP,
  MOUTH_SORROW_OVERLAP,
  useAvatarPose,
} from "./use-avatar-state";
import { applyArmPose, type ArmPose, AVATAR_URL, dampArm, frameUpperBody, prepareVrm, REST_ARM, SHOULDER_BREATH_GAIN } from "./vrm-frame";

// Expression cảm xúc do avatar-stage tự điều khiển; miệng do `useAvatarLipsync`.
/**
 * Độ nhanh khi tay chuyển tư thế giữa các trạng thái (lớn là nhanh). Dùng hai `damp` nối tiếp (đích rồi tay)
 * để chuyển động êm cả lúc bắt đầu lẫn lúc dừng; một `damp` đơn nhanh nhất ngay khung đầu nên thấy giật.
 * Hai tầng cùng giá trị 5 cho khoảng 0,8 giây đến gần đích.
 */
const ARM_DAMP = 5;
/** Độ nhanh làm mượt mức miệng dùng cho tay (chậm hơn miệng, 4.7.3b). */
const TALK_DAMP = 3.5;
const EMOTIONS = ["happy", "relaxed", "sad", "surprised"] as const;
interface AvatarStageProps {
  state: OrbState;
  /** Mic tắt: avatar chậm lại, mặt trung tính. */
  muted?: boolean;
  /** Biểu cảm bot vừa gửi; chỉ có hiệu lực khi bot đang nói. */
  expression?: ExpressionTag | null;
  /** Track âm thanh của bot, để miệng mấp máy theo giọng. */
  botTrack?: MediaStreamTrack | null;
  /** Nạp model lỗi (thiếu file, mạng): để màn hình quay về quả cầu. */
  onError?: (error: unknown) => void;
  /** Model đã hiện lần đầu. */
  onReady?: () => void;
  /** Đã ở bậc nhẹ nhất mà fps vẫn tụt: màn hình nên chuyển sang sprite 2D. */
  onLowFps?: () => void;
  className?: string;
}

export default function AvatarStage({
  state,
  muted = false,
  expression,
  botTrack,
  onError,
  onReady,
  onLowFps,
  className,
}: AvatarStageProps) {
  const poseRef = useAvatarPose(state, muted, expression);
  const { tier, downgrade } = useTier();
  const override = useMemo(fpsOverride, []);
  // `?fps=` ép cả fps lúc gọi lẫn lúc chờ để đo sức máy; khi đó tắt tự hạ bậc cho khỏi làm sai số đo.
  const config = useMemo(
    () => (override === null ? TIERS[tier] : { ...TIERS[tier], fps: override, idleFps: override }),
    [tier, override],
  );
  const showFps = useMemo(() => new URLSearchParams(location.search).has("avatar-fps"), []);
  const [modelReady, setModelReady] = useState(false);
  const handleReady = useCallback(() => {
    setModelReady(true);
    onReady?.();
  }, [onReady]);
  // Bậc đầy đủ tụt fps thì hạ xuống nhẹ; bậc nhẹ vẫn tụt thì báo màn hình chuyển sang sprite.
  const handleDecline = useCallback(() => (tier === "light" ? onLowFps?.() : downgrade()), [tier, onLowFps, downgrade]);
  const monitorOn = useMonitorArmed(modelReady && state !== "idle" && override === null);
  return (
    <div className={cn("relative size-full", className)} aria-hidden="true">
      <LoadBoundary onError={onError}>
        <Canvas
          frameloop="demand"
          dpr={config.dpr}
          camera={{ fov: 30, position: [0, 1.2, 2.5] }}
          resize={{ scroll: false }}
        >
          {/* fps tụt dưới ngưỡng thì hạ bậc; chỉ hạ (full → light → sprite), không nâng lại để tránh nhấp nháy giữa hai bậc. */}
          {monitorOn && (
            <PerformanceMonitor bounds={() => [config.fps * 0.7, config.fps + 5]} onDecline={handleDecline} />
          )}
          <FrameDriver fps={config.fps} idleFps={config.idleFps} idle={state === "idle"} showFps={showFps} tier={tier} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[1, 2, 3]} intensity={1.6} />
          <Avatar url={AVATAR_URL} poseRef={poseRef} botTrack={botTrack} config={config} onReady={handleReady} />
        </Canvas>
      </LoadBoundary>
      {showFps && <div id="avatar-fps" className="absolute left-2 top-2 font-mono text-xs text-white/80" />}
    </div>
  );
}

/** Bắt lỗi nạp model (useLoader ném lỗi khi file thiếu) để không làm sập cả màn hình. */
class LoadBoundary extends Component<{ children: ReactNode; onError?: (e: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Thời gian chờ ổn định (ms) trước khi bắt đầu đo fps để hạ bậc. */
const MONITOR_GRACE_MS = 4000;

/**
 * Bật đo fps chỉ khi `active` và tab đang hiện, sau thời gian chờ để bỏ qua đoạn nạp model,
 * biên dịch shader và lúc vừa quay lại tab. Khi chờ ở 15 fps (idle) cũng không đo, tránh hạ bậc oan.
 */
function useMonitorArmed(active: boolean) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      setArmed(false);
      if (active && !document.hidden) timer = window.setTimeout(() => setArmed(true), MONITOR_GRACE_MS);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.clearTimeout(timer);
    };
  }, [active]);
  return armed;
}

/**
 * Điều khiển nhịp vẽ: canvas ở `frameloop="demand"`, ở đây tự gọi `invalidate` theo fps của bậc.
 * Dừng hẳn khi tab ẩn. Khi `showFps`, ghi fps đo được vào phần tử `#avatar-fps`.
 */
function FrameDriver({
  fps,
  idleFps,
  idle,
  showFps,
  tier,
}: {
  fps: number;
  idleFps: number;
  idle: boolean;
  showFps: boolean;
  tier: string;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const target = idle ? idleFps : fps;
  useEffect(() => {
    let raf = 0;
    let next = 0;
    let frames = 0;
    let since = performance.now();
    const interval = Number.isFinite(target) ? 1000 / target : 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Lịch cộng dồn theo `interval` (không đo từ khung trước) để fps trung bình đúng; dung sai 4ms
      // vì rAF chạy theo nhịp màn hình (60/120 Hz, hoặc 30 Hz khi iOS tiết kiệm pin) nên hay lệch nhẹ.
      if (now < next - 4) return;
      next = now - next > interval ? now + interval : next + interval;
      invalidate();
      frames++;
      if (showFps && now - since >= 1000) {
        const el = document.getElementById("avatar-fps");
        if (el) el.textContent = `${tier} ${Math.round((frames * 1000) / (now - since))}/${Number.isFinite(target) ? target : "max"} fps`;
        frames = 0;
        since = now;
      }
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      document.removeEventListener("visibilitychange", start);
      cancelAnimationFrame(raf);
    };
  }, [target, invalidate, showFps, tier]);
  return null;
}

interface AvatarProps {
  url: string;
  config: TierConfig;
  poseRef: ReturnType<typeof useAvatarPose>;
  botTrack?: MediaStreamTrack | null;
  onReady?: () => void;
}

function Avatar({ url, config, poseRef, botTrack, onReady }: AvatarProps) {
  const { camera } = useThree();
  const sampleMouth = useAvatarLipsync(botTrack);
  const gltf = useLoader(AvatarLoader, url, registerVrm);
  const vrm = gltf.userData.vrm as VRM;
  const lookTarget = useMemo(() => new Object3D(), []);
  const blink = useRef({ next: 2, t: -1 });
  const nodPhase = useRef(0);
  // Tư thế tay hiện tại, damp dần về tư thế đích của trạng thái (4.7.3a).
  const arm = useRef<ArmPose>({ ...REST_ARM });
  const armGoal = useRef<ArmPose>({ ...REST_ARM });
  const armRight = useRef<ArmPose>({ ...REST_ARM });
  const armRightGoal = useRef<ArmPose>({ ...REST_ARM });
  const talkLevel = useRef(0);
  // `?mouth=sim`: mức miệng giả để thử tay theo miệng khi không có bot (trang thử không có track).
  const simMouth = useRef<Record<(typeof VISEMES)[number], number> | null>(
    new URLSearchParams(location.search).get("mouth") === "sim" ? { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 } : null,
  );
  const cam = useRef({ y: 0, z: 0 });

  // Chuẩn bị model một lần rồi đặt camera nửa người trên.
  useEffect(() => {
    prepareVrm(gltf, vrm);
    // Model không có xương mắt thì nhìn bằng expression lookUp/Down/Left/Right (tối đa 30°).
    if (vrm.lookAt && vrm.expressionManager) {
      const range = () => new VRMLookAtRangeMap(30, 1);
      vrm.lookAt.applier = new VRMLookAtExpressionApplier(
        vrm.expressionManager,
        range(),
        range(),
        range(),
        range(),
      );
      vrm.lookAt.target = lookTarget;
    }
    cam.current = frameUpperBody(vrm, camera as PerspectiveCamera);
    onReady?.();
    return () => VRMUtils.deepDispose(vrm.scene);
  }, [gltf, vrm, camera, lookTarget, onReady]);

  // Bậc nhẹ: ẩn các lượt vẽ outline của MToon (three-vrm tạo một material outline riêng cho mỗi mesh).
  useEffect(() => {
    vrm.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ((m as { isOutline?: boolean }).isOutline) m.visible = config.outline;
      }
    });
  }, [vrm, config.outline]);

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime;
    const { pose, muted } = poseRef.current;
    const em = vrm.expressionManager;
    const h = vrm.humanoid;
    const k = muted ? 0.5 : 1; // mic tắt thì mọi chuyển động nhẹ đi

    // Mức miệng tính trước tay, một lần mỗi khung: tay nhích theo mức mở lớn nhất của các hình miệng, làm mượt chậm.
    let mouth = sampleMouth(dt);
    if (simMouth.current) {
      // Giả giọng nói: âm tiết ~2,5 lần mỗi giây, ngắt quãng theo câu.
      const sim = simMouth.current;
      sim.aa = Math.max(0, Math.sin(t * 16)) * (Math.sin(t * 0.9) > -0.3 ? 0.8 : 0);
      mouth = sim;
    }
    let open = 0;
    for (const v of VISEMES) open = Math.max(open, mouth[v]);
    talkLevel.current = MathUtils.damp(talkLevel.current, open, TALK_DAMP, dt);
    const talk = talkLevel.current * pose.talk * k;

    // Tay hạ xuống; ngực thở và vai nhún cùng pha, lắc nhẹ khi nói.
    const breath = Math.sin(t * pose.breath.speed) * pose.breath.amp * k;
    dampArm(armGoal.current, pose.arm, ARM_DAMP, dt);
    dampArm(arm.current, armGoal.current, ARM_DAMP, dt);
    dampArm(armRightGoal.current, pose.armRight ?? pose.arm, ARM_DAMP, dt);
    dampArm(armRight.current, armRightGoal.current, ARM_DAMP, dt);
    applyArmPose(vrm, arm.current, breath * SHOULDER_BREATH_GAIN, armRight.current, talk);
    const chest = h.getNormalizedBoneNode("chest") ?? h.getNormalizedBoneNode("spine");
    if (chest) {
      chest.rotation.x = breath;
      chest.rotation.z = MathUtils.damp(chest.rotation.z, Math.sin(t * 0.9) * pose.sway * k, 4, dt);
    }

    // Điểm nhìn: con trỏ khi chưa gọi, còn lại là điểm lệch so với camera theo tư thế.
    const { x: px, y: py } = frame.pointer;
    const gx = pose.followPointer ? px * 1.5 : pose.gaze.x;
    const gy = cam.current.y + (pose.followPointer ? py * 0.8 : pose.gaze.y);
    lookTarget.position.x = MathUtils.damp(lookTarget.position.x, gx, 5, dt);
    lookTarget.position.y = MathUtils.damp(lookTarget.position.y, gy, 5, dt);
    lookTarget.position.z = cam.current.z;

    // Đầu: nghiêng, cúi/ngẩng, gật, và quay nhẹ theo hướng nhìn.
    const head = h.getNormalizedBoneNode("head");
    if (head) {
      nodPhase.current += dt * pose.nod.hz * Math.PI * 2;
      const nod = Math.sin(nodPhase.current) * pose.nod.amp * k;
      const yaw = pose.followPointer ? px * 0.3 : MathUtils.clamp(pose.gaze.x * 0.25, -0.3, 0.3);
      head.rotation.y = MathUtils.damp(head.rotation.y, yaw, 6, dt);
      head.rotation.x = MathUtils.damp(head.rotation.x, pose.pitch + nod - (pose.followPointer ? py * 0.15 : 0), 6, dt);
      head.rotation.z = MathUtils.damp(head.rotation.z, pose.tilt, 5, dt);
    }

    if (em) {
      // Chớp mắt ngẫu nhiên mỗi 2–5 giây, mỗi lần ~0.15 giây.
      const b = blink.current;
      if (b.t < 0 && t > b.next) b.t = 0;
      if (b.t >= 0) {
        b.t += dt;
        em.setValue("blink", Math.sin(Math.min(b.t / 0.15, 1) * Math.PI));
        if (b.t > 0.15) {
          b.t = -1;
          b.next = t + 2 + Math.random() * 3;
        }
      }
      for (const n of EMOTIONS) {
        const target = muted ? 0 : (pose.emotion[n] ?? 0);
        em.setValue(n, MathUtils.damp(em.getValue(n) ?? 0, target, 6, dt));
      }
      const openScale = MathUtils.clamp(
        1 - MOUTH_JOY_OVERLAP * (em.getValue("happy") ?? 0) + MOUTH_SORROW_OVERLAP * (em.getValue("sad") ?? 0),
        0.3,
        1.8,
      );
      for (const v of VISEMES) em.setValue(v, MathUtils.clamp(mouth[v] * openScale, 0, 1));
    }
    if (config.springBones) {
      vrm.update(dt);
    } else {
      // Bậc nhẹ: bỏ spring bones (tốn CPU), chỉ cập nhật phần còn lại của VRM.
      vrm.humanoid.update();
      vrm.lookAt?.update(dt);
      vrm.expressionManager?.update();
      vrm.materials?.forEach((m) => (m as { update?: (d: number) => void }).update?.(dt));
    }
  });

  return <primitive object={vrm.scene} />;
}
