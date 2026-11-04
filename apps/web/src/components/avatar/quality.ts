import { useCallback, useState } from "react";

/** Bậc chất lượng của avatar 3D (xem README: bậc 3 đầy đủ, bậc 2 nhẹ). Bậc 1–0 do màn hình xử lý. */
export type Tier = "full" | "light";

export interface TierConfig {
  /** Giới hạn fps khi bot đang nói/nghe. */
  fps: number;
  /** Giới hạn fps khi đứng yên (chưa gọi, im lặng). */
  idleFps: number;
  /** Khoảng `dpr` của canvas. */
  dpr: [number, number];
  /** Có chạy spring bones (tóc, váy) không. */
  springBones: boolean;
  /** Có vẽ outline MToon không (outline vẽ mesh thêm một lần nữa). */
  outline: boolean;
}

export const TIERS: Record<Tier, TierConfig> = {
  full: { fps: 30, idleFps: 15, dpr: [1, 1.5], springBones: true, outline: true },
  light: { fps: 20, idleFps: 10, dpr: [1, 1], springBones: false, outline: false },
};

/**
 * Ép fps để đo: `?fps=60` hoặc `?fps=0` (không giới hạn, vẽ theo nhịp màn hình).
 * Trả về `null` nếu không có tham số hợp lệ. Dùng để đo sức máy, không dùng thường ngày.
 */
export function fpsOverride(): number | null {
  const raw = new URLSearchParams(location.search).get("fps");
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n === 0 ? Number.POSITIVE_INFINITY : n;
}

/** Máy có WebGL không (kiểm tra bằng cách tạo thử một context, kết quả nhớ lại). */
let webglOk: boolean | undefined;
export function hasWebGL(): boolean {
  if (webglOk === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglOk = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglOk = false;
    }
  }
  return webglOk;
}

const TIER_KEY = "avatar-tier";

/** Dùng bậc sprite 2D khi không có WebGL, bậc nhẹ từng không đạt fps (đã nhớ lại), hoặc ép bằng `?tier=sprite`. */
export function shouldUseSprite(): boolean {
  try {
    const forced = new URLSearchParams(location.search).get("tier");
    if (forced === "sprite") return true;
    // Ép bậc 3D khác (`?tier=full|light`) thì bỏ qua giá trị đã nhớ, để còn đo được.
    if (forced === null && localStorage.getItem(TIER_KEY) === "sprite") return true;
  } catch {
    // bỏ qua
  }
  return !hasWebGL();
}

/** Nhớ là máy này không chạy nổi 3D, lần sau vào thẳng sprite. */
export function rememberSprite() {
  try {
    localStorage.setItem(TIER_KEY, "sprite");
  } catch {
    // bỏ qua
  }
}

/** Chọn bậc ban đầu: ép bằng `?tier=` hoặc localStorage (bậc đã bị hạ trước đó), nếu không thì theo cấu hình máy. */
export function pickInitialTier(): Tier {
  try {
    const forced = new URLSearchParams(location.search).get("tier");
    if (forced === "full" || forced === "light") return forced;
    const saved = localStorage.getItem(TIER_KEY);
    if (saved === "light") return saved;
  } catch {
    // localStorage bị chặn: dùng đoán theo máy
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  return cores <= 4 || memory <= 4 ? "light" : "full";
}

/** Bậc hiện tại và hàm hạ bậc (nhớ lại để lần sau khỏi phải tụt fps rồi mới hạ). */
export function useTier() {
  const [tier, setTier] = useState<Tier>(pickInitialTier);
  const downgrade = useCallback(() => {
    setTier((t) => {
      if (t === "light") return t;
      try {
        localStorage.setItem(TIER_KEY, "light");
      } catch {
        // bỏ qua
      }
      return "light";
    });
  }, []);
  return { tier, downgrade };
}
