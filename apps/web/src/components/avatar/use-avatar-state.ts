import { useRef } from "react";

import type { OrbState } from "@/components/chat-orb";

import { type ArmPose, REST_ARM } from "./vrm-frame";

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
  /** Biên độ (rad) khuỷu nhích lên theo mức miệng khi nói (4.7.3b). 0 là tay yên. */
  talk: number;
  /** Tư thế hai tay (và tay trái nếu có `armRight`). */
  arm: ArmPose;
  /** Tư thế riêng của tay phải để làm cử chỉ một tay; không có thì hai tay đối xứng theo `arm`. */
  armRight?: ArmPose;
  /** Giá trị đích của expression cảm xúc (0–1). */
  emotion: Partial<Record<"happy" | "relaxed" | "sad" | "surprised", number>>;
}

/**
 * Tay phải khi nghĩ (4.7.3a.1): nắm tay hờ chống cằm. Cánh tay trên ra trước 52° và khép vào 58°, khuỷu gập 114°
 * và đưa vào thân 32°, cổ tay gập 25°, bốn ngón cong 70°, 85°, 50°. Ngón cái vắt qua lòng bàn tay: đốt gốc y 60° và
 * z -20°, hai đốt sau cong 60°; bộ góc này tìm bằng cách dò lưới sao cho đầu ngón cái nằm trên đốt giữa ngón trỏ
 * và ngón giữa, nếu không ngón cái chìa ra ngoài nắm tay.
 * Tay trái giữ tư thế nghỉ, để mặt không bị che và nhìn ra đang nghĩ chứ không phải ngạc nhiên (hai tay áp má
 * đối xứng thì giống ngạc nhiên). Bàn tay xòe thì giống chào, nắm chặt (85°, 100°, 65°) thì giống nắm đấm;
 * Đưa khuỷu vào thân 22° thì nắm tay ở góc hàm (bên); 40° với cánh tay trên 60° thì cẳng tay nằm ngang và nắm
 * tay tụt dưới cằm. Chọn bằng cách chụp thử trên `?avatar-pose`.
 */
const deg = (d: number) => (d * Math.PI) / 180;
const THINKING_ARM_RIGHT: ArmPose = {
  ...REST_ARM,
  upperX: deg(52),
  upperZ: deg(58),
  lowerY: deg(-114),
  lowerZ: deg(32),
  handY: deg(-25),
  fingerProximal: deg(70),
  fingerIntermediate: deg(85),
  fingerDistal: deg(50),
  thumb: deg(60),
  thumbMetacarpalY: deg(60),
  thumbMetacarpalZ: deg(-20),
  thumbDistal: deg(60),
};

const BASE: AvatarPose = {
  tilt: 0,
  pitch: 0,
  gaze: { x: 0, y: 0 },
  followPointer: false,
  nod: { amp: 0, hz: 0 },
  sway: 0,
  talk: 0,
  breath: { amp: 0.015, speed: 1.6 },
  arm: REST_ARM,
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
    armRight: THINKING_ARM_RIGHT,
  },
  speaking: { ...BASE, sway: 0.03, talk: deg(8), nod: { amp: 0.025, hz: 0.6 }, emotion: { happy: 0.25 } },
};

/** Thẻ biểu cảm bot gửi qua RTVI (`avatar-expression`); khớp `EXPRESSION_TAGS` ở backend. */
export const EXPRESSION_TAGS = ["neutral", "happy", "sad", "surprised", "thinking"] as const;
export type ExpressionTag = (typeof EXPRESSION_TAGS)[number];

export function isExpressionTag(value: unknown): value is ExpressionTag {
  return typeof value === "string" && (EXPRESSION_TAGS as readonly string[]).includes(value);
}

type ExpressionOverride = Partial<Pick<AvatarPose, "tilt" | "pitch" | "gaze" | "emotion">>;

/**
 * Phần đè lên tư thế lúc bot đang nói. `emotion` thay hẳn cảm xúc nền của tư thế
 * (nên `neutral` là mặt trung tính). Model mặc định chỉ có joy / sorrow / fun / angry,
 * không có `surprised`, nên ngạc nhiên thêm ngẩng đầu và một chút vui. Cảm xúc vui và buồn
 * giữ vừa phải vì chúng đè lên vùng miệng của lipsync (xem `MOUTH_*_OVERLAP` ở avatar-stage).
 * Các giá trị là đoán ban đầu, chỉnh khi thử với bot thật.
 */
export const EXPRESSIONS: Record<ExpressionTag, ExpressionOverride> = {
  neutral: { emotion: {} },
  happy: { emotion: { happy: 0.5 } },
  sad: { pitch: 0.1, emotion: { sad: 0.45 } },
  surprised: { pitch: -0.1, emotion: { surprised: 0.8, happy: 0.25 } },
  thinking: {
    tilt: AVATAR_POSES.thinking.tilt,
    pitch: AVATAR_POSES.thinking.pitch,
    gaze: AVATAR_POSES.thinking.gaze,
    emotion: {},
  },
};

/**
 * Giữ tư thế đích hiện tại trong ref để vòng lặp vẽ đọc mỗi khung
 * mà không làm canvas render lại khi trạng thái đổi. Biểu cảm của bot chỉ có
 * hiệu lực khi bot đang nói; hết nói thì tư thế quay về của trạng thái.
 */
export function useAvatarPose(state: OrbState, muted: boolean, expression?: ExpressionTag | null) {
  const target = (): AvatarPose =>
    state === "speaking" && expression ? { ...AVATAR_POSES[state], ...EXPRESSIONS[expression] } : AVATAR_POSES[state];
  const ref = useRef<{ pose: AvatarPose; muted: boolean }>({ pose: target(), muted });
  ref.current.pose = target();
  ref.current.muted = muted;
  return ref;
}

// Morph cảm xúc của model mặc định làm biến dạng gần như cả vùng miệng, cộng dồn với miệng nói
// (đo trên file .vrm, tính theo đơn vị miệng "a"): joy cùng chiều, thêm ~0.6 mỗi đơn vị;
// sorrow ngược chiều, bớt ~0.8 mỗi đơn vị. Bù lại bằng cách co giãn độ mở của miệng nói.
export const MOUTH_JOY_OVERLAP = 0.6;
export const MOUTH_SORROW_OVERLAP = 0.8;

