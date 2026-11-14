import { type VRM, VRMUtils } from "@pixiv/three-vrm";
import { Box3, MathUtils, type PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Model mặc định; đổi bằng biến môi trường `VITE_AVATAR_URL`. File .vrm không nằm trong repo. */
export const AVATAR_URL = (import.meta.env.VITE_AVATAR_URL as string | undefined) || "/avatars/Mocking_Spit_Strawberry.vrm";

// Phần chiều cao model hiện trong khung (từ đỉnh đầu xuống), và hệ số bề ngang so với khoảng cách hai vai.
const UPPER_BODY = 0.62;
const ARM_ROOM = 4;
/** Biên độ nhún vai so với biên độ ngực (`pose.breath.amp`); giá trị khởi đầu, chỉnh bằng mắt (4.7.2). */
export const SHOULDER_BREATH_GAIN = 6;
/** Góc hạ tay khỏi tư thế chữ T (radian). */
export const ARM_RAD = MathUtils.degToRad(58);

/**
 * Tư thế một tay (góc radian, dùng cho cả hai bên: bên phải đảo dấu y và z, giữ x).
 * Trục đo ở 4.7.0.2 (docs/plans/avatar-3d/phase-4.md): z của vai và cánh tay trên là hạ xuống;
 * y của khuỷu và cổ tay âm là gập ra trước; z của khuỷu dương là đưa vào phía thân; z của ngón dương là cong về lòng bàn tay
 * (đo ở 4.7.1.1).
 */
export interface ArmPose {
  /** Vai: dương là hạ vai, âm là nhún lên (trục z). */
  shoulderZ: number;
  /** Hạ cánh tay trên khỏi tư thế chữ T (trục z). */
  upperZ: number;
  /** Khuỷu gập ra trước (y, âm là gập) và đưa vào thân (z, dương). */
  lowerY: number;
  lowerZ: number;
  /** Cổ tay gập ra trước (y, âm là gập). */
  handY: number;
  /** Ngón cong về phía lòng bàn tay (z dương) ở đốt gần, đốt giữa, đốt xa của bốn ngón dài, và ngón cái. */
  fingerProximal: number;
  fingerIntermediate: number;
  fingerDistal: number;
  thumb: number;
}

const FINGERS = ["Index", "Middle", "Ring", "Little"] as const;

/** Tư thế nghỉ (4.7.1): hạ tay bằng cả vai và cánh tay, gập nhẹ khuỷu, cổ tay thả lỏng. Giá trị khởi đầu, chỉnh bằng mắt. */
export const REST_ARM: ArmPose = {
  shoulderZ: MathUtils.degToRad(6),
  upperZ: MathUtils.degToRad(55),
  lowerY: MathUtils.degToRad(-8),
  lowerZ: MathUtils.degToRad(3),
  handY: MathUtils.degToRad(-3),
  // Giá trị khởi đầu (4.7.1.1), chỉnh bằng mắt trên trang debug.
  fingerProximal: MathUtils.degToRad(15),
  fingerIntermediate: MathUtils.degToRad(20),
  fingerDistal: MathUtils.degToRad(10),
  thumb: MathUtils.degToRad(8),
};

/**
 * Đặt tư thế hai tay. Dùng chung cho avatar 3D và cho việc chụp sprite để hai bên khớp nhau.
 * `shrug` (radian, dương là nhún vai lên) cộng thêm vào góc vai để làm nhịp thở (4.7.2), cánh tay trên bù ngược lại để tay không đung đưa; sprite không truyền nên là 0.
 * Bone nào model không có thì bỏ qua.
 */
export function applyArmPose(vrm: VRM, arm: ArmPose, shrug = 0) {
  const h = vrm.humanoid;
  const set = (side: "left" | "right", sign: 1 | -1) => {
    const shoulder = h.getNormalizedBoneNode(`${side}Shoulder`);
    const upper = h.getNormalizedBoneNode(`${side}UpperArm`);
    const lower = h.getNormalizedBoneNode(`${side}LowerArm`);
    const hand = h.getNormalizedBoneNode(`${side}Hand`);
    if (shoulder) shoulder.rotation.z = sign * (arm.shoulderZ - shrug);
    // Cánh tay trên bù đúng phần vai nhún để tổng góc không đổi: tay giữ hướng, chỉ gốc tay nhích lên (nếu không tay quét ngang như con lắc).
    if (upper) upper.rotation.z = sign * (arm.upperZ + shrug);
    if (lower) lower.rotation.set(0, sign * arm.lowerY, sign * arm.lowerZ);
    if (hand) hand.rotation.set(0, sign * arm.handY, 0);
    for (const f of FINGERS) {
      const prox = h.getNormalizedBoneNode(`${side}${f}Proximal`);
      const mid = h.getNormalizedBoneNode(`${side}${f}Intermediate`);
      const dist = h.getNormalizedBoneNode(`${side}${f}Distal`);
      if (prox) prox.rotation.z = sign * arm.fingerProximal;
      if (mid) mid.rotation.z = sign * arm.fingerIntermediate;
      if (dist) dist.rotation.z = sign * arm.fingerDistal;
    }
    const thumbProx = h.getNormalizedBoneNode(`${side}ThumbProximal`);
    if (thumbProx) thumbProx.rotation.z = sign * arm.thumb;
  };
  set("left", 1);
  set("right", -1);
}

/** Chuẩn bị model một lần: bỏ đỉnh thừa, quay VRM 0.x về hướng +z, tắt frustum culling. */
export function prepareVrm(gltf: GLTF, vrm: VRM) {
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => {
    o.frustumCulled = false;
  });
}

/**
 * Đặt camera nhìn nửa người trên (khi tay còn dang chữ T, trước khi hạ tay) và trả về
 * toạ độ y, z của camera. Dùng chung cho avatar 3D và cho việc chụp sprite để hai bên khớp khung.
 */
export function frameUpperBody(vrm: VRM, camera: PerspectiveCamera) {
  // Duyệt từng đỉnh sau khi skin vì box bind pose của three lệch nhiều so với hình thật.
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
  const { fov, aspect } = camera;
  const tan = Math.tan(MathUtils.degToRad(fov / 2));
  const z = Math.max(visible / 2 / tan, (shoulderW * ARM_ROOM) / 2 / (tan * aspect));
  camera.position.set(0, focusY, z);
  camera.lookAt(0, focusY, 0);
  return { y: focusY, z };
}
