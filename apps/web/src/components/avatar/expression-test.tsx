import { useState } from "react";

import type { OrbState } from "@/components/chat-orb";
import { cn } from "@/lib/utils";

import AvatarStage from "./avatar-stage";
import { EXPRESSION_TAGS, type ExpressionTag } from "./use-avatar-state";

const STATES: OrbState[] = ["speaking", "listening", "thinking"];

/**
 * Trang thử biểu cảm: mở bằng `/?avatar-expression`, không cần bot. Dùng đúng `AvatarStage`
 * như màn hình gọi, nên thấy đúng bảng `EXPRESSIONS`. Miệng đứng yên vì không có track bot.
 * Biểu cảm chỉ có hiệu lực ở trạng thái "speaking", giống lúc gọi thật.
 */
export function ExpressionTest() {
  const [expression, setExpression] = useState<ExpressionTag | null>(null);
  const [state, setState] = useState<OrbState>("speaking");

  return (
    <div className="flex h-dvh flex-col items-center gap-4 bg-background p-4 text-foreground">
      <div className="h-96 w-72 sm:h-[28rem] sm:w-80">
        <AvatarStage state={state} expression={expression} />
      </div>

      <Row title="Trạng thái">
        {STATES.map((s) => (
          <Pill key={s} active={state === s} onClick={() => setState(s)}>
            {s}
          </Pill>
        ))}
      </Row>
      <Row title="Thẻ biểu cảm">
        <Pill active={expression === null} onClick={() => setExpression(null)}>
          (không thẻ)
        </Pill>
        {EXPRESSION_TAGS.map((tag) => (
          <Pill key={tag} active={expression === tag} onClick={() => setExpression(tag)}>
            {tag}
          </Pill>
        ))}
      </Row>
      {state !== "speaking" && (
        <p className="text-xs text-muted-foreground">Biểu cảm chỉ hiện khi trạng thái là speaking.</p>
      )}
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className="text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full px-3 py-1", active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}
    >
      {children}
    </button>
  );
}
