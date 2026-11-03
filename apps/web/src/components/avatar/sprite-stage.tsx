import { useEffect, useRef, useState } from "react";

import type { OrbState } from "@/components/chat-orb";
import { cn } from "@/lib/utils";

import { useAvatarLipsync, VISEMES } from "./use-avatar-lipsync";
import { ALL_SPRITES, BLINK_SPRITE, type MouthLevel, spriteName, spriteUrl } from "./sprites";
import type { ExpressionTag } from "./use-avatar-state";

/** Ngưỡng độ mở (tổng các viseme) để đổi mức miệng; mở dễ hơn đóng để ảnh không nhấp nháy ở sát ngưỡng. */
const SMALL_ON = 0.12;
const SMALL_OFF = 0.08;
const WIDE_ON = 0.35;
const WIDE_OFF = 0.28;
/** Số lần cập nhật mức miệng mỗi giây; ảnh đổi rời rạc nên không cần theo nhịp màn hình. */
const MOUTH_HZ = 20;
const BLINK_MS = 150;

interface SpriteStageProps {
  state: OrbState;
  /** Mic tắt: mặt trung tính. */
  muted?: boolean;
  /** Biểu cảm bot vừa gửi; chỉ có hiệu lực khi bot đang nói. */
  expression?: ExpressionTag | null;
  /** Track âm thanh của bot, để miệng đổi theo giọng. */
  botTrack?: MediaStreamTrack | null;
  /** Không nạp được ảnh (thiếu file, mạng): để màn hình quay về quả cầu. */
  onError?: (error: unknown) => void;
  /** Bộ ảnh đã nạp xong. */
  onReady?: () => void;
  className?: string;
}

/** Biểu cảm hiện lúc này; giống cách bản 3D chọn: thẻ của bot khi đang nói, tư thế suy nghĩ khi đang nghĩ. */
function pickExpression(state: OrbState, muted: boolean, expression?: ExpressionTag | null): ExpressionTag {
  if (muted) return "neutral";
  if (state === "speaking" && expression) return expression;
  return state === "thinking" ? "thinking" : "neutral";
}

/**
 * Bậc dự phòng 2D: đổi ảnh sprite (chụp từ avatar 3D) theo biểu cảm và mức miệng.
 * Không cần WebGL; mức miệng lấy từ cùng bộ phân tích âm thanh với bản 3D.
 */
export default function SpriteStage({
  state,
  muted = false,
  expression,
  botTrack,
  onError,
  onReady,
  className,
}: SpriteStageProps) {
  const sampleMouth = useAvatarLipsync(botTrack);
  const [mouth, setMouth] = useState<MouthLevel>("closed");
  const [blinking, setBlinking] = useState(false);
  const face = pickExpression(state, muted, expression);

  // Nạp trước cả bộ để đổi ảnh không bị khựng; một ảnh hỏng thì báo lỗi cả bậc.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ALL_SPRITES.map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`không nạp được sprite ${name}`));
            img.src = spriteUrl(name);
          }),
      ),
    ).then(
      () => !cancelled && onReady?.(),
      (e: unknown) => !cancelled && onError?.(e),
    );
    return () => {
      cancelled = true;
    };
  }, [onReady, onError]);

  // Mức miệng theo giọng bot, lấy mẫu theo `MOUTH_HZ`; dừng khi tab ẩn.
  const mouthRef = useRef<MouthLevel>("closed");
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      const m = sampleMouth(Math.min((now - last) / 1000, 0.1));
      last = now;
      const open = VISEMES.reduce((sum, v) => sum + m[v], 0);
      const cur = mouthRef.current;
      let next: MouthLevel;
      if (cur === "wide") next = open >= WIDE_OFF ? "wide" : open >= SMALL_OFF ? "small" : "closed";
      else if (cur === "small") next = open >= WIDE_ON ? "wide" : open >= SMALL_OFF ? "small" : "closed";
      else next = open >= WIDE_ON ? "wide" : open >= SMALL_ON ? "small" : "closed";
      if (next !== cur) {
        mouthRef.current = next;
        setMouth(next);
      }
    }, 1000 / MOUTH_HZ);
    return () => window.clearInterval(timer);
  }, [sampleMouth]);

  // Chớp mắt ngẫu nhiên mỗi 2–5 giây.
  useEffect(() => {
    let wait = 0;
    let hold = 0;
    const schedule = () => {
      wait = window.setTimeout(
        () => {
          setBlinking(true);
          hold = window.setTimeout(() => {
            setBlinking(false);
            schedule();
          }, BLINK_MS);
        },
        2000 + Math.random() * 3000,
      );
    };
    schedule();
    return () => {
      window.clearTimeout(wait);
      window.clearTimeout(hold);
    };
  }, []);

  // Ảnh chớp mắt là mặt trung tính, nên chỉ dùng khi mặt trung tính và miệng khép.
  const name = blinking && face === "neutral" && mouth === "closed" ? BLINK_SPRITE : spriteName(face, mouth);

  return (
    <div className={cn("relative size-full", className)} aria-hidden="true">
      <img src={spriteUrl(name)} alt="" draggable={false} className="size-full select-none object-contain" />
    </div>
  );
}
