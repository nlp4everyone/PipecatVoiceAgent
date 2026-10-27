import type { PipecatClient, TransportState } from "@pipecat-ai/client-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Longest the app may stay in the background (or under a phone call) mid-call. */
const BACKGROUND_LIMIT_MS = 30_000;
/** Pause before the single reconnect attempt, so a switching network can settle. */
const RECONNECT_DELAY_MS = 1_000;

interface Options {
  client: PipecatClient | null;
  transportState: TransportState;
  inCall: boolean;
  /** Connect / start-bot failure from usePipecatApp. */
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Keeps a call sane when the phone interrupts it:
 * - App leaves the foreground (home, lock, incoming call): mute the mic and give
 *   it 30 s; coming back in time restores the mic, otherwise the call ends.
 * - Connection drops without the user ending the call: one reconnect (a new
 *   session, so the bot greets again); if that fails the normal error state with
 *   its retry button shows. Never retries in a loop.
 */
export function useCallResilience({
  client,
  transportState,
  inCall,
  error,
  connect,
  disconnect,
}: Options) {
  const [reconnecting, setReconnecting] = useState(false);
  const endedByUsRef = useRef(false);
  const retriedRef = useRef(false);
  const wasReadyRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** End the call on purpose; not treated as a dropped connection. */
  const endCall = useCallback(async () => {
    endedByUsRef.current = true;
    setReconnecting(false);
    await disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (!client || !inCall) return;
    let leftAt: number | null = null;
    let micWasOn = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (leftAt !== null) return;
        leftAt = Date.now();
        micWasOn = client.isMicEnabled;
        client.enableMic(false);
        timer = setTimeout(() => void endCall(), BACKGROUND_LIMIT_MS);
      } else if (leftAt !== null) {
        clearTimeout(timer);
        // Timers may be frozen in the background; the clock is the truth.
        const away = Date.now() - leftAt;
        leftAt = null;
        if (away >= BACKGROUND_LIMIT_MS) void endCall();
        else if (micWasOn) client.enableMic(true);
      }
    });
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [client, inCall, endCall]);

  // Not "previous state was ready": a drop goes ready -> disconnecting ->
  // disconnected, so the state just before the end is not "ready".
  useEffect(() => {
    if (transportState === "ready") {
      wasReadyRef.current = true;
      endedByUsRef.current = false;
      retriedRef.current = false;
      setReconnecting(false);
      return;
    }
    if (transportState !== "disconnected" && transportState !== "error") return;

    if (wasReadyRef.current) {
      wasReadyRef.current = false;
      if (!endedByUsRef.current && !retriedRef.current) {
        retriedRef.current = true;
        pendingRef.current = true;
        setReconnecting(true);
        // Kept out of the effect cleanup: further state changes must not cancel it.
        timerRef.current = setTimeout(() => {
          pendingRef.current = false;
          void connect();
        }, RECONNECT_DELAY_MS);
      }
    } else if (retriedRef.current && !pendingRef.current) {
      // The retry itself failed: show the usual error and retry button.
      setReconnecting(false);
    }
  }, [transportState, connect]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // The retry failed before the transport state moved (e.g. start request).
  useEffect(() => {
    if (error) setReconnecting(false);
  }, [error]);

  return { reconnecting, endCall };
}
