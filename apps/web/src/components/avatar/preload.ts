import { useLoader } from "@react-three/fiber";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { LoaderUtils } from "three";
import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { AVATAR_URL } from "./vrm-frame";

declare global {
  interface Window {
    /** Do script trong `<head>` đặt (xem `vite.config.ts`): tải model ngay khi đọc HTML, một lần duy nhất. */
    __avatarModel?: { url: string; data: Promise<ArrayBuffer> };
  }
}

/**
 * GLTFLoader dùng lại bản model đã tải từ `<head>` thay vì gọi `fetch` lần nữa. Nhờ vậy model chỉ
 * tải một lần dù server gửi `Cache-Control: no-cache` và dù hai request chạy chồng nhau. Thiếu bản
 * tải sớm, sai URL hoặc bản đó lỗi thì rơi về cách tải thường.
 */
export class AvatarLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ) {
    const early = typeof window === "undefined" ? undefined : window.__avatarModel;
    if (!early || early.url !== url) {
      super.load(url, onLoad, onProgress, onError);
      return;
    }
    early.data.then(
      (buffer) => {
        const base = this.path !== "" ? this.path : LoaderUtils.extractUrlBase(url);
        // GLTFLoader.load tự bọc parse trong try/catch; ở đây phải làm lại, nếu không file hỏng
        // ném lỗi trong promise, onError không bao giờ chạy và Suspense treo mãi.
        try {
          this.parse(buffer, base, onLoad, onError);
        } catch (e) {
          onError?.(e);
        }
      },
      () => super.load(url, onLoad, onProgress, onError),
    );
  }
}

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
    useLoader.preload(AvatarLoader, AVATAR_URL, registerVrm);
  } catch {
    // bỏ qua
  }
}
