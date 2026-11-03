import { EXPRESSION_TAGS, type ExpressionTag } from "./use-avatar-state";

/** Ba mức mở miệng của bộ sprite (thay cho độ mở liên tục của bản 3D). */
export const MOUTH_LEVELS = ["closed", "small", "wide"] as const;
export type MouthLevel = (typeof MOUTH_LEVELS)[number];

/** Độ mở `aa` dùng khi chụp từng mức miệng. `wide` gần mức tối đa của lipsync 3D (MAX_OPEN = 0.7). */
export const MOUTH_OPEN: Record<MouthLevel, number> = { closed: 0, small: 0.25, wide: 0.6 };

/** Ảnh mắt nhắm (mặt trung tính, miệng khép), dùng để chớp mắt. */
export const BLINK_SPRITE = "blink";

export const SPRITE_DIR = "/avatars/sprites";
export const SPRITE_EXT = "webp";
/** Kích thước ảnh sprite (px); tỉ lệ 3:4 giống khung avatar 3D. */
export const SPRITE_SIZE = { width: 480, height: 640 } as const;

export function spriteName(expression: ExpressionTag, mouth: MouthLevel) {
  return `${expression}-${mouth}`;
}

export function spriteUrl(name: string) {
  return `${SPRITE_DIR}/${name}.${SPRITE_EXT}`;
}

/** Tên mọi sprite trong bộ: mỗi biểu cảm × mỗi mức miệng, cộng ảnh chớp mắt. */
export const ALL_SPRITES: string[] = [
  ...EXPRESSION_TAGS.flatMap((e) => MOUTH_LEVELS.map((m) => spriteName(e, m))),
  BLINK_SPRITE,
];
