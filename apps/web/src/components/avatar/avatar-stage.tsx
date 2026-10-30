import {
  type VRM,
  VRMLoaderPlugin,
  VRMLookAtExpressionApplier,
  VRMLookAtRangeMap,
  VRMUtils,
} from "@pixiv/three-vrm";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { Box3, MathUtils, Object3D, type PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { OrbState } from "@/components/chat-orb";
import { cn } from "@/lib/utils";

import { useAvatarLipsync, VISEMES } from "./use-avatar-lipsync";
import { useAvatarPose } from "./use-avatar-state";

/** Model mặc định; đổi bằng biến môi trường `VITE_AVATAR_URL`. File .vrm không nằm trong repo. */
const AVATAR_URL = (import.meta.env.VITE_AVATAR_URL as string | undefined) || "/avatars/Mocking_Spit_Strawberry.vrm";
// Phần chiều cao model hiện trong khung (từ đỉnh đầu xuống), và hệ số bề ngang so với khoảng cách hai vai.
const UPPER_BODY = 0.62;
const ARM_ROOM = 4;
// Góc hạ tay khỏi tư thế chữ T (độ).
const ARM_RAD = MathUtils.degToRad(58);
// Expression cảm xúc do avatar-stage tự điều khiển; miệng do `useAvatarLipsync`.
const EMOTIONS = ["happy", "relaxed", "sad"] as const;

interface AvatarStageProps {
  state: OrbState;
  /** Mic tắt: avatar chậm lại, mặt trung tính. */
  muted?: boolean;
  /** Track âm thanh của bot, để miệng mấp máy theo giọng. */
  botTrack?: MediaStreamTrack | null;
  /** Nạp model lỗi (thiếu file, mạng): để màn hình quay về quả cầu. */
  onError?: (error: unknown) => void;
  /** Model đã hiện lần đầu. */
  onReady?: () => void;
  className?: string;
}

export default function AvatarStage({ state, muted = false, botTrack, onError, onReady, className }: AvatarStageProps) {
  const poseRef = useAvatarPose(state, muted);
  return (
    <div className={cn("relative size-full", className)} aria-hidden="true">
      <LoadBoundary onError={onError}>
        <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 1.2, 2.5] }} resize={{ scroll: false }}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[1, 2, 3]} intensity={1.6} />
          <Avatar url={AVATAR_URL} poseRef={poseRef} botTrack={botTrack} onReady={onReady} />
        </Canvas>
      </LoadBoundary>
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

interface AvatarProps {
  url: string;
  poseRef: ReturnType<typeof useAvatarPose>;
  botTrack?: MediaStreamTrack | null;
  onReady?: () => void;
}

function Avatar({ url, poseRef, botTrack, onReady }: AvatarProps) {
  const { camera } = useThree();
  const sampleMouth = useAvatarLipsync(botTrack);
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const vrm = gltf.userData.vrm as VRM;
  const lookTarget = useMemo(() => new Object3D(), []);
  const blink = useRef({ next: 2, t: -1 });
  const nodPhase = useRef(0);
  const cam = useRef({ y: 0, z: 0 });

  // Chuẩn bị model một lần: bỏ đỉnh thừa, quay VRM 0.x về hướng +z, đặt camera nửa người trên.
  useEffect(() => {
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o) => {
      o.frustumCulled = false;
    });
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

    // Khung nửa người trên: duyệt từng đỉnh sau khi skin vì box bind pose của three lệch nhiều so với hình thật.
    vrm.scene.updateMatrixWorld(true);
    const box = new Box3();
    const v = new Vector3();
    vrm.scene.traverse((o) => {
      if (!(o instanceof SkinnedMesh)) return;
      o.skeleton.update();
      for (let i = 0; i < o.geometry.attributes.position.count; i++) {
        o.getVertexPosition(i, v);
        box.expandByPoint(v.applyMatrix4(o.matrixWorld));
      }
    });
    const height = box.max.y - box.min.y;
    // Khung nửa người trên: từ đỉnh đầu xuống quanh eo, chừa một chút khoảng trống phía trên đầu.
    const visible = height * UPPER_BODY;
    const focusY = box.max.y - visible * 0.5 + height * 0.04;
    // Bề ngang lấy theo vai chứ không theo hộp bao (lúc đó tay còn dang chữ T, sẽ hạ xuống ngay),
    // nhân thêm để chừa chỗ cho tay.
    const lShoulder = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
    const rShoulder = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
    const shoulderW =
      lShoulder && rShoulder
        ? lShoulder.getWorldPosition(v).distanceTo(rShoulder.getWorldPosition(new Vector3()))
        : (box.max.x - box.min.x) * 0.4;
    const { fov, aspect } = camera as PerspectiveCamera;
    const tan = Math.tan(MathUtils.degToRad(fov / 2));
    const z = Math.max(visible / 2 / tan, (shoulderW * ARM_ROOM) / 2 / (tan * aspect));
    camera.position.set(0, focusY, z);
    camera.lookAt(0, focusY, 0);
    cam.current = { y: focusY, z };
    onReady?.();
    return () => VRMUtils.deepDispose(vrm.scene);
  }, [gltf, vrm, camera, lookTarget, onReady]);

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime;
    const { pose, muted } = poseRef.current;
    const em = vrm.expressionManager;
    const h = vrm.humanoid;
    const k = muted ? 0.5 : 1; // mic tắt thì mọi chuyển động nhẹ đi

    // Tay hạ xuống; ngực thở, lắc nhẹ khi nói.
    const lArm = h.getNormalizedBoneNode("leftUpperArm");
    const rArm = h.getNormalizedBoneNode("rightUpperArm");
    if (lArm) lArm.rotation.z = ARM_RAD;
    if (rArm) rArm.rotation.z = -ARM_RAD;
    const chest = h.getNormalizedBoneNode("chest") ?? h.getNormalizedBoneNode("spine");
    if (chest) {
      chest.rotation.x = Math.sin(t * pose.breath.speed) * pose.breath.amp * k;
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
      const mouth = sampleMouth(dt);
      for (const v of VISEMES) em.setValue(v, mouth[v]);
    }
    vrm.update(dt);
  });

  return <primitive object={vrm.scene} />;
}
