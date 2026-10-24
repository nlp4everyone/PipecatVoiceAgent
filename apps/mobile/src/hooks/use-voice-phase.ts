// Ported from apps/web/src/components/voice-screen.tsx; keep the phase rules in sync.

import {
  type PipecatClient,
  RTVIEvent,
  type TransportState,
} from "@pipecat-ai/client-js";
import { useEffect, useState } from "react";

/** Who holds the turn, from RTVI events. Decides what the orb reacts to. */
export type Phase = "listening" | "userSpeaking" | "thinking" | "botSpeaking";

export type OrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking";

/** Whose audio level drives the orb; null means it only breathes. */
export type LevelSource = "bot" | "local" | null;

/** Transport is starting up, or connected but the bot has not sent bot-ready. */
export const CONNECTING_STATES: TransportState[] = [
  "initializing",
  "authenticating",
  "authenticated",
  "connecting",
  "connected",
];

// Screen-reader only: on screen the orb shows the state.
const PHASE_LABEL: Record<Phase, string> = {
  listening: "Đang nghe",
  userSpeaking: "Đang nghe",
  thinking: "Đang suy nghĩ",
  botSpeaking: "Đang nói",
};

export function useVoicePhase(
  client: PipecatClient | null,
  transportState: TransportState,
  micEnabled: boolean,
) {
  const [phase, setPhase] = useState<Phase>("listening");

  useEffect(() => {
    if (!client) return;
    const toListening = () => setPhase("listening");
    const onUserStarted = () => setPhase("userSpeaking");
    const onUserStopped = () => setPhase("thinking");
    const onBotStarted = () => setPhase("botSpeaking");
    // On barge-in UserStartedSpeaking can arrive before BotStoppedSpeaking:
    // only go back to listening if the bot still holds the turn.
    const onBotStopped = () =>
      setPhase((p) => (p === "botSpeaking" ? "listening" : p));
    const onTransportStateChanged = (state: TransportState) => {
      if (state !== "ready") toListening();
    };

    client.on(RTVIEvent.TransportStateChanged, onTransportStateChanged);
    client.on(RTVIEvent.UserStartedSpeaking, onUserStarted);
    client.on(RTVIEvent.UserStoppedSpeaking, onUserStopped);
    client.on(RTVIEvent.BotStartedSpeaking, onBotStarted);
    client.on(RTVIEvent.BotStoppedSpeaking, onBotStopped);
    return () => {
      client.off(RTVIEvent.TransportStateChanged, onTransportStateChanged);
      client.off(RTVIEvent.UserStartedSpeaking, onUserStarted);
      client.off(RTVIEvent.UserStoppedSpeaking, onUserStopped);
      client.off(RTVIEvent.BotStartedSpeaking, onBotStarted);
      client.off(RTVIEvent.BotStoppedSpeaking, onBotStopped);
      setPhase("listening");
    };
  }, [client]);

  const isReady = transportState === "ready";
  const isConnecting = CONNECTING_STATES.includes(transportState);
  const inCall = isReady || isConnecting;
  const muted = isReady && !micEnabled;

  const levelSource: LevelSource =
    phase === "botSpeaking"
      ? "bot"
      : phase === "userSpeaking" && micEnabled
        ? "local"
        : null;

  const orbState: OrbState = !inCall
    ? "idle"
    : isConnecting
      ? "connecting"
      : phase === "thinking"
        ? "thinking"
        : levelSource
          ? "speaking"
          : "listening";

  const statusLabel = !inCall
    ? "Chưa kết nối"
    : isConnecting
      ? "Đang kết nối"
      : muted
        ? "Micro đang tắt"
        : PHASE_LABEL[phase];

  return {
    phase,
    orbState,
    levelSource,
    statusLabel,
    isReady,
    isConnecting,
    inCall,
    muted,
  };
}
