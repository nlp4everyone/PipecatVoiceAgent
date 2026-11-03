import { type VRM, VRMLoaderPlugin, VRMLookAtExpressionApplier, VRMLookAtRangeMap } from "@pixiv/three-vrm";
import { useEffect, useState } from "react";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  ALL_SPRITES,
  BLINK_SPRITE,
  MOUTH_LEVELS,
  MOUTH_OPEN,
  SPRITE_EXT,
  SPRITE_SIZE,
  spriteName,
} from "./sprites";
import {
  AVATAR_POSES,
  EXPRESSION_TAGS,
  EXPRESSIONS,
  type ExpressionTag,
  MOUTH_JOY_OVERLAP,
  MOUTH_SORROW_OVERLAP,
} from "./use-avatar-state";
import { ARM_RAD, AVATAR_URL, frameUpperBody, prepareVrm } from "./vrm-frame";

declare global {
  interface Window {
    /** Kết quả chụp: tên sprite → data URL. `tools/capture-sprites.mjs` đọc từ đây. */
    __sprites?: Record<string, string>;
    __spritesDone?: boolean;
    __spritesError?: string;
  }
}

const EMOTION_EXPRESSIONS = ["happy", "relaxed", "sad", "surprised"] as const;
const ALL_EXPRESSIONS = [...EMOTION_EXPRESSIONS, "aa", "ih", "ou", "ee", "oh", "blink"] as const;

interface Shot {
  expression: ExpressionTag;
  /** Độ mở miệng `aa` (0–1). */
  open: number;
  blink?: boolean;
}

/** Danh sách ảnh cần chụp, đúng tên trong `ALL_SPRITES`. */
function shots(): Record<string, Shot> {
  const out: Record<string, Shot> = {};
  for (const e of EXPRESSION_TAGS) {
    for (const m of MOUTH_LEVELS) out[spriteName(e, m)] = { expression: e, open: MOUTH_OPEN[m] };
  }
  out[BLINK_SPRITE] = { expression: "neutral", open: 0, blink: true };
  return out;
}

/** Dựng tư thế tĩnh cho một ảnh, giống `Avatar` trong avatar-stage nhưng không có chuyển động. */
function applyShot(vrm: VRM, shot: Shot, look: Object3D, cam: { y: number; z: number }) {
  const pose = { ...AVATAR_POSES.speaking, ...EXPRESSIONS[shot.expression] };
  const h = vrm.humanoid;
  const em = vrm.expressionManager;

  const lArm = h.getNormalizedBoneNode("leftUpperArm");
  const rArm = h.getNormalizedBoneNode("rightUpperArm");
  if (lArm) lArm.rotation.z = ARM_RAD;
  if (rArm) rArm.rotation.z = -ARM_RAD;

  const head = h.getNormalizedBoneNode("head");
  if (head) {
    head.rotation.set(pose.pitch, MathUtils.clamp(pose.gaze.x * 0.25, -0.3, 0.3), pose.tilt);
  }
  look.position.set(pose.gaze.x, cam.y + pose.gaze.y, cam.z);

  if (em) {
    for (const n of ALL_EXPRESSIONS) em.setValue(n, 0);
    for (const n of EMOTION_EXPRESSIONS) em.setValue(n, pose.emotion[n] ?? 0);
    const openScale = MathUtils.clamp(
      1 - MOUTH_JOY_OVERLAP * (em.getValue("happy") ?? 0) + MOUTH_SORROW_OVERLAP * (em.getValue("sad") ?? 0),
      0.3,
      1.8,
    );
    em.setValue("aa", MathUtils.clamp(shot.open * openScale, 0, 1));
    if (shot.blink) em.setValue("blink", 1);
  }
  // Chạy vài chục bước để spring bones (tóc, váy) ổn định theo tư thế mới.
  for (let i = 0; i < 40; i++) vrm.update(1 / 60);
}

async function capture(onProgress: (done: number, total: number) => void) {
  const { width, height } = SPRITE_SIZE;
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  // Cùng mặc định với <Canvas> của react-three-fiber để màu khớp bản 3D.
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 2, 3);
  scene.add(sun);
  const camera = new PerspectiveCamera(30, width / height, 0.1, 100);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(AVATAR_URL);
  const vrm = gltf.userData.vrm as VRM;
  prepareVrm(gltf, vrm);
  const look = new Object3D();
  if (vrm.lookAt && vrm.expressionManager) {
    const range = () => new VRMLookAtRangeMap(30, 1);
    vrm.lookAt.applier = new VRMLookAtExpressionApplier(vrm.expressionManager, range(), range(), range(), range());
    vrm.lookAt.target = look;
  }
  scene.add(vrm.scene);
  const cam = frameUpperBody(vrm, camera);

  const list = shots();
  const result: Record<string, string> = {};
  let done = 0;
  for (const name of ALL_SPRITES) {
    const shot = list[name];
    if (!shot) throw new Error(`thiếu cấu hình chụp cho ${name}`);
    applyShot(vrm, shot, look, cam);
    renderer.render(scene, camera);
    result[name] = await new Promise<string>((resolve, reject) => {
      renderer.domElement.toBlob(
        (blob) => {
          if (!blob) return reject(new Error(`không xuất được ${name}`));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
        `image/${SPRITE_EXT}`,
        0.92,
      );
    });
    onProgress(++done, ALL_SPRITES.length);
  }
  renderer.dispose();
  return result;
}

/**
 * Trang chụp sprite: mở bằng `/?avatar-sprites`. Dựng từng tổ hợp biểu cảm × mức miệng bằng đúng
 * model và khung camera của avatar 3D, xuất ảnh nền trong suốt vào `window.__sprites`.
 * Chạy tự động bằng `tools/capture-sprites.mjs`; mở tay thì ảnh hiện bên dưới để xem.
 */
export function SpriteCapture() {
  const [progress, setProgress] = useState("Đang chụp…");
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    capture((done, total) => setProgress(`Đang chụp ${done}/${total}`))
      .then((result) => {
        window.__sprites = result;
        window.__spritesDone = true;
        setImages(result);
        setProgress(`Xong ${Object.keys(result).length} ảnh`);
      })
      .catch((e: unknown) => {
        window.__spritesError = String((e as Error)?.stack ?? e);
        setProgress(`Lỗi: ${window.__spritesError}`);
      });
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-300 p-4 text-sm text-neutral-900">
      <p className="mb-3 font-mono">{progress}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(images).map(([name, src]) => (
          <figure key={name} className="w-40">
            <img src={src} alt={name} className="w-full" />
            <figcaption className="text-center font-mono text-xs">{name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
