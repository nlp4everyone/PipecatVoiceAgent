import type { Transport } from "@pipecat-ai/client-js";

// Copied from apps/web/src/lib/transports.ts; only INSTALL_HINTS and the
// registrations at the bottom differ.

export type TransportType = "daily" | "smallwebrtc";
export type TransportOptions = Record<string, unknown>;
export type TransportFactory = (
  options?: TransportOptions,
) => Transport | Promise<Transport>;
type TransportConstructor = new (options?: TransportOptions) => Transport;
export type TransportLoader = () => Promise<TransportConstructor>;

const INSTALL_HINTS: Record<TransportType, string> = {
  daily: "npm install @pipecat-ai/react-native-daily-transport",
  smallwebrtc:
    "npm install @pipecat-ai/react-native-small-webrtc-transport @pipecat-ai/react-native-daily-media-manager",
};
const loaders = new Map<TransportType, { loader: TransportLoader }[]>();

/** Register before mounting usePipecatApp. Cleanup removes this registration without discarding other loaders. */
export function registerTransport(
  type: TransportType,
  loader: TransportLoader,
) {
  if (!Object.hasOwn(INSTALL_HINTS, type))
    throw new Error(`Unsupported transport type: ${String(type)}`);
  const entry = { loader };
  const entries = loaders.get(type) ?? [];
  entries.push(entry);
  loaders.set(type, entries);
  return () => {
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
    if (!entries.length && loaders.get(type) === entries) loaders.delete(type);
  };
}

/** Load a transport explicitly registered by the host app. */
export async function loadTransport(
  type: TransportType,
): Promise<TransportConstructor> {
  if (!Object.hasOwn(INSTALL_HINTS, type)) {
    throw new Error(`Unsupported transport type: ${String(type)}`);
  }
  const loader = loaders.get(type)?.at(-1)?.loader;
  if (!loader) {
    throw new Error(
      `No loader registered for "${type}". Install the package (${INSTALL_HINTS[type]}) and pass transportFactory to usePipecatApp, or registerTransport("${type}", loader) before mounting it.`,
    );
  }
  try {
    return await loader();
  } catch (cause) {
    throw new Error(
      `Failed to load transport "${type}": ${cause instanceof Error ? cause.message : String(cause)}. Check the package is installed (${INSTALL_HINTS[type]}).`,
      { cause },
    );
  }
}

/** Create a transport registered by the host, without importing optional packages here. */
export async function createTransport(
  type: TransportType,
  options?: TransportOptions,
): Promise<Transport> {
  const Constructor = await loadTransport(type);
  return new Constructor(options);
}

// SmallWebRTC needs a media manager for mic/speaker; DailyMediaManager only
// drives local devices and never joins a Daily room.
registerTransport("smallwebrtc", async () => {
  const [{ RNSmallWebRTCTransport }, { DailyMediaManager }] = await Promise.all(
    [
      import("@pipecat-ai/react-native-small-webrtc-transport"),
      import("@pipecat-ai/react-native-daily-media-manager"),
    ],
  );
  return class extends RNSmallWebRTCTransport {
    constructor(options?: TransportOptions) {
      super({ ...options, mediaManager: new DailyMediaManager() });
    }
  } as unknown as TransportConstructor;
});

// "daily": register @pipecat-ai/react-native-daily-transport here when needed.
