import {
  type BotOutputData,
  type PipecatClient,
  RTVIEvent,
  TextType,
  type TranscriptData,
  type TransportState,
} from "@pipecat-ai/client-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { CONNECTING_STATES } from "@/hooks/use-voice-phase";

export interface ConversationMessage {
  id: string;
  role: "user" | "bot";
  text: string;
}

let nextId = 0;
const newId = () => String(++nextId);

/**
 * Transport state, transcript and mic state for one screen, from client events.
 * Bot text comes from BotOutput (RTVI 2.x): one segment per sentence, updated
 * as it is spoken, so an interrupted sentence keeps only the spoken part.
 */
export function useConversation(client: PipecatClient | null) {
  const [transportState, setTransportState] =
    useState<TransportState>("initialized");
  const [micEnabled, setMicEnabled] = useState(true);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Events arrive one at a time, so refs hold the source of truth and state
  // only mirrors it for rendering.
  const messagesRef = useRef<ConversationMessage[]>([]);
  const transportStateRef = useRef<TransportState>("initialized");
  // Bot segment id -> the bubble it belongs to; bubble id -> its segments' text.
  const segmentOwnerRef = useRef(new Map<number, string>());
  const bubbleSegmentsRef = useRef(new Map<string, Map<number, string>>());

  const commit = useCallback((next: ConversationMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  useEffect(() => {
    if (!client) return;
    transportStateRef.current = client.state;
    setTransportState(client.state);
    setMicEnabled(client.isMicEnabled);

    const onTransportStateChanged = (state: TransportState) => {
      const prev = transportStateRef.current;
      transportStateRef.current = state;
      // A fresh session starts with an empty transcript.
      if (
        CONNECTING_STATES.includes(state) &&
        !CONNECTING_STATES.includes(prev)
      ) {
        segmentOwnerRef.current.clear();
        bubbleSegmentsRef.current.clear();
        commit([]);
      }
      setTransportState(state);
      if (state === "ready") setMicEnabled(client.isMicEnabled);
    };

    const onUserTranscript = (data: TranscriptData) => {
      const text = data.text.trim();
      if (!data.final || !text) return;
      const prev = messagesRef.current;
      const last = prev.at(-1);
      commit(
        last?.role === "user"
          ? [...prev.slice(0, -1), { ...last, text: `${last.text} ${text}` }]
          : [...prev, { id: newId(), role: "user", text }],
      );
    };

    const onBotOutput = (data: BotOutputData) => {
      const textType = data.text_type ?? data.aggregated_by;
      if (data.will_be_spoken === false || textType === TextType.BACKCHANNEL)
        return;
      const segmentId = data.segment_id;
      if (segmentId === undefined) return;
      const text =
        data.spoken_status === "in-progress"
          ? (data.spoken_progress?.accumulated_text ?? "")
          : data.spoken_status === "new"
            ? ""
            : data.text;

      let next = messagesRef.current;
      let bubbleId = segmentOwnerRef.current.get(segmentId);
      if (!bubbleId) {
        // Consecutive bot segments form one bubble until the user speaks.
        const last = next.at(-1);
        if (last?.role === "bot") {
          bubbleId = last.id;
        } else {
          bubbleId = newId();
          next = [...next, { id: bubbleId, role: "bot", text: "" }];
        }
        segmentOwnerRef.current.set(segmentId, bubbleId);
      }
      let segments = bubbleSegmentsRef.current.get(bubbleId);
      if (!segments) {
        segments = new Map();
        bubbleSegmentsRef.current.set(bubbleId, segments);
      }
      segments.set(segmentId, text.trim());
      const joined = [...segments.values()].filter(Boolean).join(" ");
      commit(next.map((m) => (m.id === bubbleId ? { ...m, text: joined } : m)));
    };

    client.on(RTVIEvent.TransportStateChanged, onTransportStateChanged);
    client.on(RTVIEvent.UserTranscript, onUserTranscript);
    client.on(RTVIEvent.BotOutput, onBotOutput);
    return () => {
      client.off(RTVIEvent.TransportStateChanged, onTransportStateChanged);
      client.off(RTVIEvent.UserTranscript, onUserTranscript);
      client.off(RTVIEvent.BotOutput, onBotOutput);
    };
  }, [client, commit]);

  const toggleMic = useCallback(() => {
    if (!client) return;
    const enable = !client.isMicEnabled;
    client.enableMic(enable);
    setMicEnabled(enable);
  }, [client]);

  return { transportState, messages, micEnabled, toggleMic };
}
