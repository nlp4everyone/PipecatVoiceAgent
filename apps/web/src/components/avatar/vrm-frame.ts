import { type VRM, VRMUtils } from "@pixiv/three-vrm";
import { Box3, MathUtils, type PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Model mặc định; đổi bằng biến môi trường `VITE_AVATAR_URL`. File .vrm không nằm trong repo. */
export const AVATAR_URL = (import.meta.env.VITE_AVATAR_URL as string | undefined) || "/avatars/Mocking_Spit_Strawberry.vrm";

// Phần chiều cao model hiện trong khung (từ đỉnh đầu xuống), và hệ số bề ngang so với khoảng cách hai vai.
const UPPER_BODY = 0.62;
const ARM_ROOM = 4;
/** Góc hạ tay khỏi tư thế chữ T (radian). */
export const ARM_RAD = MathUtils.degToRad(58);

/**
 * Tư thế một tay (góc radian, dùng cho cả hai bên: bên phải được đảo dấu). Hiện chỉ có cánh tay trên;
 * vai, khuỷu và cổ tay sẽ thêm ở 4.7.0.2 sau khi xác định trục xoay của từng bone.
 */
export interface ArmPose {
  /** Hạ cánh tay trên khỏi tư thế chữ T (xoay quanh trục z). */
  upper: number;
}

/**
 * Đặt tư thế hai tay. Dùng chung cho avatar 3D và cho việc chụp sprite để hai bên khớp nhau.
 * Bone nào model không có thì bỏ qua.
 */
export function applyArmPose(vrm: VRM, arm: ArmPose) {
  const h = vrm.humanoid;
  const left = h.getNormalizedBoneNode("leftUpperArm");
  const right = h.getNormalizedBoneNode("rightUpperArm");
  if (left) left.rotation.z = arm.upper;
  if (right) right.rotation.z = -arm.upper;
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
