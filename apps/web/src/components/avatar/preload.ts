import { useLoader } from "@react-three/fiber";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { AVATAR_URL } from "./vrm-frame";

/** Đăng ký plugin VRM cho loader; dùng chung giữa `Avatar` và tải trước để khoá cache khớp nhau. */
export function registerVrm(loader: GLTFLoader) {
  loader.register((parser) => new VRMLoaderPlugin(parser));
}

/**
 * Tải trước model vào cache của `useLoader` (khoá theo loader và url) để `Avatar` không phải đợi.
 * Màn hình gọi ngay khi vào, chạy song song với việc nạp chunk `avatar-stage`. Lỗi không ném ra ở
 * đây: `Avatar` sẽ gặp lại lỗi đó khi render và `LoadBoundary` xử lý như thường.
 */
export function preloadAvatar() {
  try {
    useLoader.preload(GLTFLoader, AVATAR_URL, registerVrm);
  } catch {
    // bỏ qua
  }
}
