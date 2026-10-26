import type { TransportState } from "@pipecat-ai/client-js";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef } from "react";

const KEEP_AWAKE_TAG = "voice-call";

/**
 * Haptics when the call becomes ready / ends / fails, and keeps the screen awake
 * while a call is in progress. No chimes: expo-audio takes the iOS audio session
 * away from the call and the bot goes silent (even with allowsRecording).
 */
export function useCallFeedback(
  transportState: TransportState,
  inCall: boolean,
) {
  const wasReady = useRef(false);

  useEffect(() => {
    const isReady = transportState === "ready";
    if (isReady && !wasReady.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (!isReady && wasReady.current) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (transportState === "error") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    wasReady.current = isReady;
  }, [transportState]);

  useEffect(() => {
    if (!inCall) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [inCall]);
}
