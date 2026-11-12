import { type VRM, VRMUtils } from "@pixiv/three-vrm";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AxesHelper, MathUtils } from "three";

import { cn } from "@/lib/utils";

import { AvatarLoader, registerVrm } from "./preload";
import { ARM_RAD, AVATAR_URL, prepareVrm } from "./vrm-frame";

declare global {
  interface Window {
    /** Đặt true khi model đã hiện, để script chụp ảnh biết lúc chụp. */
    __poseReady?: boolean;
    /** Model đang hiện, để script đo trục xoay của bone (xem 4.7.0.2). */
    __poseVrm?: VRM;
  }
}

/**
 * Trang chỉnh tư thế tay (4.7.0.2): mở bằng `/?avatar-pose`, không cần bot. Mỗi bone có ba thanh trượt
 * x/y/z (độ) để tìm trục xoay của vai, cánh tay trên, khuỷu và cổ tay trong không gian normalized của VRM 0.x.
 * Trang không dùng `applyArmPose` mà đặt thẳng `rotation` của bone, nên thấy được cả những trục mà hàm đó chưa có.
 *
 * Tham số URL (đều tuỳ chọn): `shoulder`, `upper`, `lower`, `hand` dạng `x,y,z` (độ); `order` (thứ tự Euler);
 * `mirror=0` để bên phải dùng đúng giá trị bên trái; `axes=1` hiện trục của bone; `view=front|side|top`;
 * `cam=x,y,z` và `target=x,y,z` để đặt camera tự do (dùng cho chụp ảnh tự động); `model=/avatars/X.vrm`
 * để thử model khác `VITE_AVATAR_URL`.
 */

const MODEL_URL = new URLSearchParams(location.search).get("model") ?? AVATAR_URL;

const GROUPS = [
  { key: "shoulder", label: "Vai", bone: "Shoulder" },
  { key: "upper", label: "Cánh tay trên", bone: "UpperArm" },
  { key: "lower", label: "Khuỷu (cẳng tay)", bone: "LowerArm" },
  { key: "hand", label: "Cổ tay", bone: "Hand" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];
type Vec = [number, number, number];
type Values = Record<GroupKey, Vec>;

const ORDERS = ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"] as const;
type Order = (typeof ORDERS)[number];

const VIEWS = {
  front: { cam: [0, 1.1, 2.4], target: [0, 1.1, 0] },
  side: { cam: [2.4, 1.1, 0], target: [0, 1.1, 0] },
  top: { cam: [0, 3.2, 0.01], target: [0, 1.1, 0] },
} as const satisfies Record<string, { cam: Vec; target: Vec }>;
type ViewKey = keyof typeof VIEWS;

const DEFAULTS: Values = {
  shoulder: [0, 0, 0],
  upper: [0, 0, Math.round(MathUtils.radToDeg(ARM_RAD))],
  lower: [0, 0, 0],
  hand: [0, 0, 0],
};

interface Config {
  values: Values;
  order: Order;
  mirror: boolean;
  axes: boolean;
}

function readVec(params: URLSearchParams, name: string): Vec | null {
  const raw = params.get(name);
  if (!raw) return null;
  const v = raw.split(",").map(Number);
  return v.length === 3 && v.every(Number.isFinite) ? (v as Vec) : null;
}

function initial() {
  const params = new URLSearchParams(location.search);
  const values = { ...DEFAULTS };
  for (const g of GROUPS) values[g.key] = readVec(params, g.key) ?? DEFAULTS[g.key];
  const order = (ORDERS as readonly string[]).includes(params.get("order") ?? "") ? (params.get("order") as Order) : "XYZ";
  const view = (params.get("view") ?? "front") as ViewKey;
  return {
    values,
    order,
    mirror: params.get("mirror") !== "0",
    axes: params.get("axes") === "1",
    view: view in VIEWS ? view : ("front" as ViewKey),
    cam: readVec(params, "cam"),
    target: readVec(params, "target"),
  };
}

export function PoseTest() {
  const start = useMemo(initial, []);
  const [values, setValues] = useState<Values>(start.values);
  const [order, setOrder] = useState<Order>(start.order);
  const [mirror, setMirror] = useState(start.mirror);
  const [axes, setAxes] = useState(start.axes);
  const [view, setView] = useState<ViewKey>(start.view);
  const [custom, setCustom] = useState<{ cam: Vec; target: Vec } | null>(
    start.cam && start.target ? { cam: start.cam, target: start.target } : null,
  );
  const config: Config = { values, order, mirror, axes };
  const shot = custom ?? VIEWS[view];

  const set = (key: GroupKey, i: number, v: number) =>
    setValues((cur) => ({ ...cur, [key]: cur[key].map((x, j) => (j === i ? v : x)) as Vec }));

  // Chuỗi tham số có thể dán vào URL để mở lại đúng tư thế này.
  const query = useMemo(() => {
    const p = new URLSearchParams({ "avatar-pose": "" });
    for (const g of GROUPS) p.set(g.key, values[g.key].join(","));
    p.set("order", order);
    if (!mirror) p.set("mirror", "0");
    return "?" + p.toString().replace("avatar-pose=", "avatar-pose").replaceAll("%2C", ",");
  }, [values, order, mirror]);

  return (
    <div className="relative h-dvh bg-background text-foreground">
      <Canvas
        camera={{ fov: 30, position: [...shot.cam] }}
        dpr={1}
        gl={{ preserveDrawingBuffer: true }}
        resize={{ scroll: false }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[1, 2, 3]} intensity={1.6} />
        <OrbitControls makeDefault target={[...shot.target]} />
        <CameraRig cam={shot.cam} target={shot.target} />
        <PoseAvatar config={config} />
      </Canvas>

      <div className="absolute right-2 top-2 flex max-h-[calc(100dvh-1rem)] w-72 flex-col gap-3 overflow-y-auto rounded-lg bg-background/90 p-3 text-xs shadow">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Góc nhìn</span>
          {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
            <Pill
              key={k}
              active={!custom && view === k}
              onClick={() => {
                setCustom(null);
                setView(k);
              }}
            >
              {k}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
            Đối xứng bên phải
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={axes} onChange={(e) => setAxes(e.target.checked)} />
            Hiện trục
          </label>
          <label className="flex items-center gap-1">
            Euler
            <select
              className="rounded bg-muted px-1 py-0.5"
              value={order}
              onChange={(e) => setOrder(e.target.value as Order)}
            >
              {ORDERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>

        {GROUPS.map((g) => (
          <fieldset key={g.key} className="flex flex-col gap-1">
            <legend className="mb-1 font-medium">{g.label}</legend>
            {(["x", "y", "z"] as const).map((axis, i) => (
              <label key={axis} className="flex items-center gap-2">
                <span className="w-3 font-mono uppercase text-muted-foreground">{axis}</span>
                <input
                  className="min-w-0 flex-1"
                  type="range"
                  min={-120}
                  max={120}
                  step={1}
                  value={values[g.key][i]}
                  onChange={(e) => set(g.key, i, Number(e.target.value))}
                />
                <span className="w-9 text-right font-mono">{values[g.key][i]}°</span>
              </label>
            ))}
          </fieldset>
        ))}

        <div className="flex items-center gap-2">
          <Pill active={false} onClick={() => setValues(DEFAULTS)}>
            Đặt lại
          </Pill>
          <Pill
            active={false}
            onClick={() => {
              try {
                void navigator.clipboard.writeText(location.origin + "/" + query);
              } catch {
                // clipboard không dùng được (HTTP, từ chối quyền): người dùng chép tay ở ô bên dưới
              }
            }}
          >
            Sao chép URL
          </Pill>
        </div>
        <textarea
          readOnly
          className="h-16 w-full resize-none rounded bg-muted p-1 font-mono text-[10px]"
          value={query}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  );
}

/** Đặt lại vị trí camera khi đổi góc nhìn; OrbitControls tự đọc lại từ camera ở lần cập nhật kế. */
function CameraRig({ cam, target }: { cam: Vec | readonly number[]; target: Vec | readonly number[] }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null;
  useEffect(() => {
    camera.position.set(cam[0], cam[1], cam[2]);
    controls?.target.set(target[0], target[1], target[2]);
    controls?.update();
  }, [camera, controls, cam, target]);
  return null;
}

function PoseAvatar({ config }: { config: Config }) {
  const gltf = useLoader(AvatarLoader, MODEL_URL, registerVrm);
  const vrm = gltf.userData.vrm as VRM;
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    // StrictMode chạy effect hai lần; quay VRM 0.x hai lần sẽ lật model ngược lại.
    if (!gltf.userData.poseTestPrepared) {
      prepareVrm(gltf, vrm);
      gltf.userData.poseTestPrepared = true;
    }
    window.__poseReady = true;
    window.__poseVrm = vrm;
    return () => {
      window.__poseReady = false;
      window.__poseVrm = undefined;
    };
  }, [gltf, vrm]);

  // Trục của bone (đỏ x, xanh lá y, xanh dương z) gắn vào bone normalized để nhìn thấy hướng xoay.
  useEffect(() => {
    if (!config.axes) return;
    const added: AxesHelper[] = [];
    for (const side of ["left", "right"]) {
      for (const g of GROUPS) {
        const node = vrm.humanoid.getNormalizedBoneNode(`${side}${g.bone}` as "leftUpperArm");
        if (!node) continue;
        const helper = new AxesHelper(0.12);
        (helper.material as { depthTest: boolean }).depthTest = false;
        helper.renderOrder = 10;
        node.add(helper);
        added.push(helper);
      }
    }
    return () => {
      for (const h of added) {
        h.removeFromParent();
        h.dispose();
      }
    };
  }, [vrm, config.axes]);

  useFrame((_, dt) => {
    const { values, order, mirror } = configRef.current;
    for (const side of ["left", "right"] as const) {
      // Bên phải đảo dấu y và z, giống cách `applyArmPose` đảo z; đổi bằng ô "Đối xứng".
      const sign = side === "right" && mirror ? -1 : 1;
      for (const g of GROUPS) {
        const node = vrm.humanoid.getNormalizedBoneNode(`${side}${g.bone}` as "leftUpperArm");
        if (!node) continue;
        const [x, y, z] = values[g.key];
        node.rotation.set(MathUtils.degToRad(x), MathUtils.degToRad(y * sign), MathUtils.degToRad(z * sign), order);
      }
    }
    vrm.update(dt);
  });

  useEffect(() => () => VRMUtils.deepDispose(vrm.scene), [vrm]);

  return <primitive object={vrm.scene} />;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full px-3 py-1", active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}
    >
      {children}
    </button>
  );
}
