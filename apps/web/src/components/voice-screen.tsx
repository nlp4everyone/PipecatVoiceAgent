import { RTVIEvent } from "@pipecat-ai/client-js";
import {
  usePipecatClientMediaTrack,
  usePipecatClientMicControl,
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import {
  CaptionsIcon,
  CaptionsOffIcon,
  MessageSquareTextIcon,
  MicIcon,
  MicOffIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { ChatOrb, type OrbState } from "@/components/chat-orb";
import { unlockBotAudio } from "@/components/pipecat/bot-audio";
import { Conversation } from "@/components/pipecat/conversation";
import { TextInput } from "@/components/pipecat/text-input";
import { TranscriptOverlay } from "@/components/pipecat/transcript-overlay";
import { playConnectChime, playEndChime, unlockChimes } from "@/lib/chimes";
import { cn } from "@/lib/utils";

/** Pha hội thoại, suy ra từ các event RTVI. Quyết định quả cầu phản ứng theo ai. */
type Phase = "listening" | "userSpeaking" | "thinking" | "botSpeaking";

const CONNECTING_STATES = new Set([
  "initializing",
  "authenticating",
  "authenticated",
  "connecting",
  "connected", // transport đã nối, bot chưa gửi bot-ready
]);

// Chỉ dùng cho trình đọc màn hình: trên giao diện, trạng thái thể hiện qua quả cầu.
const PHASE_LABEL: Record<Phase, string> = {
  listening: "Đang nghe",
  userSpeaking: "Đang nghe",
  thinking: "Đang suy nghĩ",
  botSpeaking: "Đang nói",
};

interface VoiceScreenProps {
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  error: string | null;
}

export function VoiceScreen({ onConnect, onDisconnect, error }: VoiceScreenProps) {
  const transportState = usePipecatClientTransportState();
  const { enableMic, isMicEnabled } = usePipecatClientMicControl();
  const botTrack = usePipecatClientMediaTrack("audio", "bot");
  const userTrack = usePipecatClientMediaTrack("audio", "local");

  const [phase, setPhase] = useState<Phase>("listening");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const wasReadyRef = useRef(false);

  const isReady = transportState === "ready";
  const isConnecting = CONNECTING_STATES.has(transportState);
  const inCall = isReady || isConnecting;

  useRTVIClientEvent(RTVIEvent.TransportStateChanged, (state) => {
    if (state === "ready") {
      wasReadyRef.current = true;
      playConnectChime();
      return;
    }
    if (wasReadyRef.current) {
      wasReadyRef.current = false;
      playEndChime();
    }
    setPhase("listening");
  });
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, () => setPhase("userSpeaking"));
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, () => setPhase("thinking"));
  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, () => setPhase("botSpeaking"));
  // Khi bị ngắt lời, UserStartedSpeaking có thể tới trước BotStoppedSpeaking:
  // chỉ quay về "nghe" nếu bot vẫn đang là người nói.
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, () =>
    setPhase((p) => (p === "botSpeaking" ? "listening" : p)),
  );

  // Quả cầu nhảy theo giọng bot khi bot nói, theo mic khi người dùng nói,
  // còn lại "thở" nhẹ (track = null).
  const orbTrack =
    phase === "botSpeaking" ? botTrack : phase === "userSpeaking" && isMicEnabled ? userTrack : null;

  const orbState: OrbState = !inCall
    ? "idle"
    : isConnecting
      ? "connecting"
      : phase === "thinking"
        ? "thinking"
        : orbTrack
          ? "speaking"
          : "listening";

  const srStatus = !inCall
    ? "Chưa kết nối"
    : isConnecting
      ? "Đang kết nối"
      : !isMicEnabled
        ? "Micro đang tắt"
        : PHASE_LABEL[phase];

  // Dòng chữ duy nhất dưới quả cầu: gợi ý trước khi gọi, hoặc báo mic đang tắt.
  const hint = !inCall ? "Chạm để bắt đầu trò chuyện" : isReady && !isMicEnabled ? "Micro đang tắt" : null;

  const handleStart = () => {
    // Phải gọi trong lúc người dùng bấm, nếu không iOS Safari chặn tiếng.
    unlockBotAudio();
    unlockChimes();
    void onConnect();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <main className="relative flex min-w-0 flex-1 flex-col items-center">
        <header className="flex h-16 w-full items-center justify-end gap-1 px-3 sm:px-5">
          {inCall && (
            <>
              <IconButton
                label={captionsOn ? "Tắt phụ đề" : "Bật phụ đề"}
                onClick={() => setCaptionsOn((v) => !v)}
                variant="ghost"
              >
                {captionsOn ? <CaptionsIcon /> : <CaptionsOffIcon />}
              </IconButton>
              <IconButton
                label={chatOpen ? "Ẩn hội thoại" : "Xem hội thoại"}
                onClick={() => setChatOpen((v) => !v)}
                variant="ghost"
                active={chatOpen}
              >
                <MessageSquareTextIcon />
              </IconButton>
            </>
          )}
        </header>

        <section className="flex w-full flex-1 flex-col items-center justify-center gap-8 px-4">
          <button
            type="button"
            onClick={inCall ? undefined : handleStart}
            disabled={inCall}
            aria-label="Bắt đầu trò chuyện"
            className={cn(
              "rounded-full transition-opacity duration-500",
              !inCall && "cursor-pointer",
              isReady && !isMicEnabled && "opacity-70",
            )}
          >
            <ChatOrb track={orbTrack} state={orbState} muted={isReady && !isMicEnabled} size={240} />
          </button>

          <p className="sr-only" aria-live="polite">
            {srStatus}
          </p>

          {/* Phụ đề lời bot (từng chữ, theo BotOutput); không hiện transcript của người dùng. */}
          <div className="flex min-h-28 w-full max-w-xl flex-col items-center justify-start gap-2">
            {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
            {captionsOn && isReady && phase !== "userSpeaking" && phase !== "thinking" && (
              <TranscriptOverlay size="lg" />
            )}
            {error && (
              <p className="max-w-md text-center text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>

        <footer className="flex h-28 items-center justify-center gap-3 pb-6">
          {inCall && (
            <>
              <IconButton
                label={isMicEnabled ? "Tắt micro" : "Bật micro"}
                onClick={() => enableMic(!isMicEnabled)}
                active={!isMicEnabled}
                disabled={!isReady}
              >
                {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
              <button
                type="button"
                onClick={() => void onDisconnect()}
                className="inline-flex h-14 items-center rounded-full bg-foreground px-7 text-base font-medium text-background transition hover:opacity-85"
              >
                Kết thúc
              </button>
            </>
          )}
        </footer>
      </main>

      {/* Panel hội thoại: transcript đầy đủ + gõ chữ trong lúc gọi. */}
      {inCall && chatOpen && (
        <aside className="absolute inset-0 z-10 flex flex-col border-border bg-background sm:static sm:w-96 sm:border-l">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">Hội thoại</span>
            <IconButton label="Đóng" onClick={() => setChatOpen(false)} size="sm" variant="ghost">
              <XIcon />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <Conversation />
          </div>
          <div className="p-4">
            <TextInput placeholder="Nhắn tin…" disconnectedPlaceholder="Chưa kết nối" />
          </div>
        </aside>
      )}
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: "filled" | "ghost";
  size?: "sm" | "md";
}

function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  variant = "filled",
  size = "md",
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition disabled:opacity-40",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && (variant === "ghost" ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-6"),
        active
          ? "bg-foreground text-background hover:opacity-90"
          : variant === "ghost"
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "bg-muted text-foreground hover:bg-muted/70",
      )}
    >
      {children}
    </button>
  );
}
