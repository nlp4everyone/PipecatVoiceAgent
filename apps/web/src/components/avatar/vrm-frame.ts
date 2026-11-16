import { type VRM, VRMLookAtExpressionApplier, VRMLookAtRangeMap, VRMUtils } from "@pixiv/three-vrm";
import { Box3, MathUtils, type Object3D, type PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { ArmPose } from "./arm-pose";

// Định nghĩa ở arm-pose.ts (không có three) để bundle chính không kéo three vào; re-export để chỗ khác import như cũ.
export { ARM_RAD, type ArmPose, REST_ARM } from "./arm-pose";

/** Model mặc định; đổi bằng biến môi trường `VITE_AVATAR_URL`. File .vrm không nằm trong repo. */
export const AVATAR_URL = (import.meta.env.VITE_AVATAR_URL as string | undefined) || "/avatars/AvatarSample_E.web.vrm";

// Phần chiều cao model hiện trong khung (từ đỉnh đầu xuống), và hệ số bề ngang so với khoảng cách hai vai.
const UPPER_BODY = 0.62;
const ARM_ROOM = 4;
/** Cổ tay gập thêm bao nhiêu lần so với khuỷu khi tay nhích theo miệng (4.7.3b); giá trị khởi đầu, chỉnh bằng mắt. */
const TALK_HAND_RATIO = 0.6;
/** Biên độ nhún vai so với biên độ ngực (`pose.breath.amp`); giá trị khởi đầu, chỉnh bằng mắt (4.7.2). */
export const SHOULDER_BREATH_GAIN = 6;

const FINGERS = ["Index", "Middle", "Ring", "Little"] as const;

/** Đưa `cur` về `target` từng trường một bằng `damp` (sửa trực tiếp `cur`), để tay chuyển mượt giữa các trạng thái (4.7.3a). */
export function dampArm(cur: ArmPose, target: ArmPose, lambda: number, dt: number) {
  for (const key of Object.keys(target) as (keyof ArmPose)[]) cur[key] = MathUtils.damp(cur[key], target[key], lambda, dt);
}

/**
 * Đặt tư thế hai tay. Dùng chung cho avatar 3D và cho việc chụp sprite để hai bên khớp nhau.
 * `talk` (radian, dương là nhích lên) gập thêm khuỷu và cổ tay hai bên theo mức miệng khi nói (4.7.3b); không đụng cánh tay trên.
 * `armRight` là tư thế riêng của tay phải (mặc định bằng `arm`, tức đối xứng), dùng cho cử chỉ một tay (4.7.3a.1).
 * `shrug` (radian, dương là nhún vai lên) cộng thêm vào góc vai để làm nhịp thở (4.7.2), cánh tay trên bù ngược lại để tay không đung đưa; sprite không truyền nên là 0.
 * Bone nào model không có thì bỏ qua.
 */
export function applyArmPose(vrm: VRM, arm: ArmPose, shrug = 0, armRight: ArmPose = arm, talk = 0) {
  const h = vrm.humanoid;
  const set = (side: "left" | "right", sign: 1 | -1, arm: ArmPose) => {
    const shoulder = h.getNormalizedBoneNode(`${side}Shoulder`);
    const upper = h.getNormalizedBoneNode(`${side}UpperArm`);
    const lower = h.getNormalizedBoneNode(`${side}LowerArm`);
    const hand = h.getNormalizedBoneNode(`${side}Hand`);
    if (shoulder) shoulder.rotation.z = sign * (arm.shoulderZ - shrug);
    // Cánh tay trên bù đúng phần vai nhún để tổng góc không đổi: tay giữ hướng, chỉ gốc tay nhích lên (nếu không tay quét ngang như con lắc).
    if (upper) upper.rotation.set(arm.upperX, 0, sign * (arm.upperZ + shrug));
    if (lower) lower.rotation.set(0, sign * (arm.lowerY - talk), sign * arm.lowerZ);
    if (hand) hand.rotation.set(0, sign * (arm.handY - talk * TALK_HAND_RATIO), 0);
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
    const thumbMeta = h.getNormalizedBoneNode(`${side}ThumbMetacarpal`);
    if (thumbMeta) thumbMeta.rotation.set(0, sign * arm.thumbMetacarpalY, sign * arm.thumbMetacarpalZ);
    const thumbDist = h.getNormalizedBoneNode(`${side}ThumbDistal`);
    if (thumbDist) thumbDist.rotation.z = sign * arm.thumbDistal;
  };
  set("left", 1, arm);
  set("right", -1, armRight);
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

/** Model không có xương mắt thì nhìn bằng expression lookUp/Down/Left/Right (tối đa 30°); `target` là điểm để nhìn theo. */
export function setupLookAt(vrm: VRM, target: Object3D) {
  if (!vrm.lookAt || !vrm.expressionManager) return;
  const range = () => new VRMLookAtRangeMap(30, 1);
  vrm.lookAt.applier = new VRMLookAtExpressionApplier(vrm.expressionManager, range(), range(), range(), range());
  vrm.lookAt.target = target;
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
