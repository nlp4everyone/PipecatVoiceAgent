import {
  VRM,
  VRMLoaderPlugin,
  VRMLookAtExpressionApplier,
  VRMLookAtRangeMap,
  VRMUtils,
} from "@pixiv/three-vrm";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, MathUtils, Object3D, type PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Trang thử avatar (phase 0.4): mở bằng `/?avatar-test`, chưa nối với bot. */

const DEFAULT_MODEL = "/avatars/Mocking_Spit_Strawberry.vrm";
// Góc hạ tay khỏi tư thế chữ T (độ); chỉnh thử bằng `?arm=`.
const DEFAULT_ARM_DEG = 58;

// Tên expression chuẩn VRM 1.0 (three-vrm tự đổi tên VRM 0.x: joy → happy, sorrow → sad, fun → relaxed).
const MOUTH = ["aa", "ih", "ou", "ee", "oh"] as const;
const EMOTION = ["happy", "sad", "angry", "relaxed"] as const;
const DRIVEN = [...MOUTH, ...EMOTION];

interface Stats {
  fps: number;
  triangles: number;
}

export function AvatarTest() {
  const modelUrl = useMemo(() => new URLSearchParams(location.search).get("model") ?? DEFAULT_MODEL, []);
  const targetRef = useRef<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ fps: 0, triangles: 0 });
  const [available, setAvailable] = useState<string[]>([]);

  const pick = (name: string | null) => {
    targetRef.current = name ? { [name]: 1 } : {};
    setActive(name);
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground">
      <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 1.2, 2.5] }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[1, 2, 3]} intensity={1.6} />
        <Avatar url={modelUrl} targetRef={targetRef} onExpressions={setAvailable} />
        <StatsProbe onStats={setStats} />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-3 py-2 font-mono text-xs">
        <div>{stats.fps} fps</div>
        <div>{(stats.triangles / 1000).toFixed(1)}k tam giác / khung</div>
        <div className="text-muted-foreground">{modelUrl.split("/").pop()}</div>
      </div>

      <div className="absolute right-3 top-3 flex max-w-60 flex-col gap-2 rounded-md bg-background/80 p-3 text-xs">
        <Group title="Miệng" names={MOUTH} active={active} available={available} onPick={pick} />
        <Group title="Cảm xúc" names={EMOTION} active={active} available={available} onPick={pick} />
        <button
          type="button"
          onClick={() => pick(null)}
          className="rounded-full bg-muted px-3 py-1 hover:bg-muted/70"
        >
          Về trung tính
        </button>
      </div>
    </div>
  );
}

function Group({
  title,
  names,
  active,
  available,
  onPick,
}: {
  title: string;
  names: readonly string[];
  active: string | null;
  available: string[];
  onPick: (name: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!available.includes(n)}
            onClick={() => onPick(n)}
            className={
              "rounded-full px-3 py-1 disabled:opacity-30 " +
              (active === n ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70")
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

interface AvatarProps {
  url: string;
  /** Expression đang bật (giá trị đích 0–1); tên không có trong đây thì về 0. */
  targetRef: React.RefObject<Record<string, number>>;
  onExpressions: (names: string[]) => void;
}

function Avatar({ url, targetRef, onExpressions }: AvatarProps) {
  const { camera } = useThree();
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const vrm = gltf.userData.vrm as VRM;
  const lookTarget = useMemo(() => new Object3D(), []);
  const blink = useRef({ next: 2, t: -1 });
  const armRad = useMemo(
    () => MathUtils.degToRad(Number(new URLSearchParams(location.search).get("arm") ?? DEFAULT_ARM_DEG)),
    [],
  );

  // Chuẩn bị model một lần: bỏ đỉnh thừa, quay VRM 0.x về hướng +z, đặt camera nửa người trên.
  useEffect(() => {
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o) => {
      o.frustumCulled = false;
    });
    // Không có xương mắt thì dùng expression lookUp/Down/Left/Right để nhìn.
    if (vrm.lookAt && vrm.expressionManager) {
      // Góc nhìn tối đa 30° ứng với expression = 1.
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
    onExpressions(Object.keys(vrm.expressionManager?.expressionMap ?? {}));

    // Khung nửa người trên: đỉnh đầu ở sát mép trên. Chibi đầu rất to nên đầu chiếm ~2/3 chiều cao, cần ~95% mới thấy tới hông và hai tay.
    // Box mặc định của three dùng bind pose, lệch hẳn so với hình đã skin (chibi: cao gấp đôi bộ xương),
    // nên duyệt từng đỉnh sau khi skin. Chạy một lần khi nạp, ~vài chục nghìn đỉnh.
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
    const visible = height * 0.95;
    const focusY = box.max.y - visible * 0.5 + height * 0.04;
    const persp = camera as PerspectiveCamera;
    camera.position.set(0, focusY, visible / 2 / Math.tan(MathUtils.degToRad(persp.fov / 2)));
    camera.lookAt(0, focusY, 0);
    return () => VRMUtils.deepDispose(vrm.scene);
  }, [gltf, vrm, camera, lookTarget, onExpressions]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const em = vrm.expressionManager;
    const h = vrm.humanoid;

    // Tư thế nghỉ: hạ tay xuống khỏi tư thế chữ T, thở nhẹ ở ngực.
    const lArm = h.getNormalizedBoneNode("leftUpperArm");
    const rArm = h.getNormalizedBoneNode("rightUpperArm");
    if (lArm) lArm.rotation.z = armRad;
    if (rArm) rArm.rotation.z = -armRad;
    const chest = h.getNormalizedBoneNode("chest") ?? h.getNormalizedBoneNode("spine");
    if (chest) chest.rotation.x = Math.sin(t * 1.6) * 0.015;

    // Đầu và mắt nhìn theo con trỏ (làm mượt để không giật).
    const { x, y } = state.pointer;
    lookTarget.position.set(x * 1.5, camera.position.y + y * 0.8, 2);
    const head = h.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.y = MathUtils.damp(head.rotation.y, x * 0.3, 6, dt);
      head.rotation.x = MathUtils.damp(head.rotation.x, -y * 0.15, 6, dt);
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
      // Miệng và cảm xúc tiến dần về giá trị đích.
      for (const n of DRIVEN) {
        const cur = em.getValue(n) ?? 0;
        em.setValue(n, MathUtils.damp(cur, targetRef.current[n] ?? 0, 12, dt));
      }
    }
    vrm.update(dt);
  });

  return <primitive object={vrm.scene} />;
}

/** Đếm fps và số tam giác mỗi khung, báo lại mỗi 0.5 giây. */
function StatsProbe({ onStats }: { onStats: (s: Stats) => void }) {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame(({ gl }, dt) => {
    const a = acc.current;
    a.frames += 1;
    a.time += dt;
    if (a.time >= 0.5) {
      onStats({ fps: Math.round(a.frames / a.time), triangles: gl.info.render.triangles });
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}
