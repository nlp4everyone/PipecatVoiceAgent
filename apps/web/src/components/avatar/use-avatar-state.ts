import { useRef } from "react";

import type { OrbState } from "@/components/chat-orb";

/** Tư thế đích của avatar cho một trạng thái hội thoại. Góc tính bằng radian. */
export interface AvatarPose {
  /** Nghiêng đầu sang bên (xoay quanh trục z). */
  tilt: number;
  /** Cúi (+) hoặc ngẩng (−) đầu. */
  pitch: number;
  /** Điểm nhìn so với camera, đơn vị mét ở mặt phẳng trước mặt avatar; (0,0) là nhìn thẳng camera. */
  gaze: { x: number; y: number };
  /** Nhìn theo con trỏ thay vì điểm `gaze` (chỉ khi chưa gọi). */
  followPointer: boolean;
  /** Biên độ gật đầu (rad) và tần số (Hz). 0 là không gật. */
  nod: { amp: number; hz: number };
  /** Biên độ lắc người nhẹ khi nói (rad). */
  sway: number;
  /** Nhịp thở: biên độ (rad) và tần số (rad/giây). */
  breath: { amp: number; speed: number };
  /** Giá trị đích của expression cảm xúc (0–1). */
  emotion: Partial<Record<"happy" | "relaxed" | "sad", number>>;
}

const BASE: AvatarPose = {
  tilt: 0,
  pitch: 0,
  gaze: { x: 0, y: 0 },
  followPointer: false,
  nod: { amp: 0, hz: 0 },
  sway: 0,
  breath: { amp: 0.015, speed: 1.6 },
  emotion: {},
};

/** Mỗi trạng thái có một tư thế riêng (điều chỉnh khi thử trên màn hình thật). */
export const AVATAR_POSES: Record<OrbState, AvatarPose> = {
  idle: { ...BASE, followPointer: true, breath: { amp: 0.012, speed: 1.3 }, emotion: { relaxed: 0.25 } },
  connecting: { ...BASE, pitch: 0.04, nod: { amp: 0.06, hz: 0.9 }, emotion: { happy: 0.2 } },
  listening: { ...BASE, tilt: 0.1, emotion: { happy: 0.15 } },
  thinking: {
    ...BASE,
    tilt: -0.14,
    pitch: -0.08,
    gaze: { x: 0.5, y: 0.45 },
    breath: { amp: 0.01, speed: 1.2 },
  },
  speaking: { ...BASE, sway: 0.03, nod: { amp: 0.025, hz: 0.6 }, emotion: { happy: 0.25 } },
};

/**
 * Giữ tư thế đích hiện tại trong ref để vòng lặp vẽ đọc mỗi khung
 * mà không làm canvas render lại khi trạng thái đổi.
 */
export function useAvatarPose(state: OrbState, muted: boolean) {
  const ref = useRef<{ pose: AvatarPose; muted: boolean }>({ pose: AVATAR_POSES[state], muted });
  ref.current.pose = AVATAR_POSES[state];
  ref.current.muted = muted;
  return ref;
}
