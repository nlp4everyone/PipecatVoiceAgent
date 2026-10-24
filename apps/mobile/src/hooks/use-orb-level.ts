import { type PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { useEffect, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";

import type { LevelSource } from "@/hooks/use-voice-phase";

/**
 * WebRTC's audioLevel (0..1, linear, 1 = full scale) mapped to orb swell.
 * The web's RMS gain (x7) saturates here: measured bot speech on Android sits
 * around p25 0.14, p50 0.19, p90 0.33, which this maps to ~0.3 / 0.45 / 0.8.
 */
function toOrbLevel(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, (raw - 0.02) * 2.6));
}

/**
 * Audio level for the orb, from the transport's level events (~every 80 ms,
 * see patches/). Follows the bot or the mic depending on `source`; 0 when
 * neither is speaking. Written to a shared value so React never re-renders.
 */
export function useOrbLevel(client: PipecatClient | null, source: LevelSource) {
  const level = useSharedValue(0);
  const sourceRef = useRef(source);

  useEffect(() => {
    sourceRef.current = source;
    if (!source) level.value = 0;
  }, [source, level]);

  useEffect(() => {
    if (!client) return;
    const onLocal = (raw: number) => {
      if (sourceRef.current === "local") level.value = toOrbLevel(raw);
    };
    const onRemote = (raw: number) => {
      if (sourceRef.current === "bot") level.value = toOrbLevel(raw);
    };
    client.on(RTVIEvent.LocalAudioLevel, onLocal);
    client.on(RTVIEvent.RemoteAudioLevel, onRemote);
    return () => {
      client.off(RTVIEvent.LocalAudioLevel, onLocal);
      client.off(RTVIEvent.RemoteAudioLevel, onRemote);
      level.value = 0;
    };
  }, [client, level]);

  return level;
}
