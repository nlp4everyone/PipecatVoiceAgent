import { RTVIEvent, type TranscriptData } from "@pipecat-ai/client-js";
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
import { useState } from "react";

import { AudioVisualizerWaveView } from "@/components/pipecat/audio-visualizer-wave";
import { unlockBotAudio } from "@/components/pipecat/bot-audio";
import { Conversation } from "@/components/pipecat/conversation";
import { TextInput } from "@/components/pipecat/text-input";
import { TranscriptOverlay } from "@/components/pipecat/transcript-overlay";
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

const PHASE_LABEL: Record<Phase, string> = {
  listening: "Đang nghe",
  userSpeaking: "Đang nghe",
  thinking: "Đang suy nghĩ…",
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
  const [userCaption, setUserCaption] = useState("");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  const isReady = transportState === "ready";
  const isConnecting = CONNECTING_STATES.has(transportState);
  const inCall = isReady || isConnecting;

  useRTVIClientEvent(RTVIEvent.TransportStateChanged, (state) => {
    if (state !== "ready") {
      setPhase("listening");
      setUserCaption("");
    }
  });
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, () => {
    setPhase("userSpeaking");
    setUserCaption("");
  });
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, () => setPhase("thinking"));
  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, () => {
    setPhase("botSpeaking");
    setUserCaption("");
  });
  // Khi bị ngắt lời, UserStartedSpeaking có thể tới trước BotStoppedSpeaking:
  // chỉ quay về "nghe" nếu bot vẫn đang là người nói.
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, () =>
    setPhase((p) => (p === "botSpeaking" ? "listening" : p)),
  );
  useRTVIClientEvent(RTVIEvent.UserTranscript, (data: TranscriptData) =>
    setUserCaption(data.text),
  );

  // Quả cầu nhảy theo giọng bot khi bot nói, theo mic khi người dùng nói,
  // còn lại "thở" nhẹ (track = null).
  const orbTrack =
    phase === "botSpeaking" ? botTrack : phase === "userSpeaking" && isMicEnabled ? userTrack : null;

  const status = !inCall
    ? "Nhấn để bắt đầu trò chuyện"
    : isConnecting
      ? "Đang kết nối…"
      : !isMicEnabled
        ? "Micro đang tắt"
        : PHASE_LABEL[phase];

  const handleStart = () => {
    unlockBotAudio(); // phải gọi trong lúc người dùng bấm, nếu không iOS Safari chặn tiếng
    void onConnect();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <main className="relative flex min-w-0 flex-1 flex-col items-center">
        <header className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-sm font-medium text-muted-foreground">VoiceAgent</span>
          {inCall && (
            <IconButton
              label={chatOpen ? "Ẩn hội thoại" : "Xem hội thoại"}
              onClick={() => setChatOpen((v) => !v)}
              active={chatOpen}
            >
              <MessageSquareTextIcon />
            </IconButton>
          )}
        </header>

        <section className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4">
          <button
            type="button"
            onClick={inCall ? undefined : handleStart}
            disabled={inCall}
            aria-label="Bắt đầu trò chuyện"
            className={cn(
              "rounded-full transition-transform duration-500",
              !inCall && "cursor-pointer hover:scale-105",
              !isMicEnabled && isReady && "opacity-50",
            )}
          >
            <AudioVisualizerWaveView
              track={orbTrack}
              isConnecting={isConnecting}
              isThinking={isReady && phase === "thinking"}
              color="#3B82F6"
              accentColor="#A5F3FC"
              themeMode="dark"
              size={280}
            />
          </button>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {status}
          </p>

          {/* Phụ đề: lời bot (từng chữ, theo BotOutput) và lời người dùng (STT). */}
          <div className="flex min-h-24 w-full max-w-xl flex-col items-center justify-start gap-2">
            {captionsOn && isReady && (
              <>
                {phase === "userSpeaking" || phase === "thinking" ? (
                  userCaption && (
                    <p className="text-center text-base text-balance text-muted-foreground">
                      {userCaption}
                    </p>
                  )
                ) : (
                  <TranscriptOverlay size="lg" />
                )}
              </>
            )}
          </div>

          {error && (
            <p className="max-w-md text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </section>

        <footer className="flex items-center justify-center gap-4 pb-10">
          {inCall ? (
            <>
              <IconButton
                label={captionsOn ? "Tắt phụ đề" : "Bật phụ đề"}
                onClick={() => setCaptionsOn((v) => !v)}
              >
                {captionsOn ? <CaptionsIcon /> : <CaptionsOffIcon />}
              </IconButton>
              <IconButton
                label={isMicEnabled ? "Tắt micro" : "Bật micro"}
                onClick={() => enableMic(!isMicEnabled)}
                active={!isMicEnabled}
                size="lg"
                disabled={!isReady}
              >
                {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
              <IconButton label="Kết thúc" onClick={() => void onDisconnect()} tone="danger">
                <XIcon />
              </IconButton>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Bắt đầu trò chuyện
            </button>
          )}
        </footer>
      </main>

      {/* Panel hội thoại: transcript đầy đủ + gõ chữ trong lúc gọi. */}
      {inCall && chatOpen && (
        <aside className="absolute inset-0 z-10 flex flex-col border-border bg-background sm:static sm:w-96 sm:border-l">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium">Hội thoại</span>
            <IconButton label="Đóng" onClick={() => setChatOpen(false)} size="sm">
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
  tone?: "default" | "danger";
  size?: "sm" | "md" | "lg";
}

function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  tone = "default",
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
        size === "md" && "size-14 [&_svg]:size-6",
        size === "lg" && "size-16 [&_svg]:size-7",
        tone === "danger"
          ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
          : active
            ? "bg-foreground text-background hover:opacity-90"
            : "bg-muted text-foreground hover:bg-muted/70",
      )}
    >
      {children}
    </button>
  );
}
