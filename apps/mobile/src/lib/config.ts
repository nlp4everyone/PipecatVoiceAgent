import type { TransportType } from "@/lib/transports";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface AppConfig {
  /** Bot base URL without trailing slash, e.g. https://pc.tailnet.ts.net:8443 */
  botUrl: string;
  /** Sent as X-App-Key with /start and the offer request; null when unset. */
  appKey: string | null;
  transport: TransportType;
  /** Overrides the iceConfig returned by /start; null means use the bot's. */
  iceServers: IceServer[] | null;
}

// Expo only inlines EXPO_PUBLIC_* when accessed as process.env.NAME literally.
const env = {
  botUrl: process.env.EXPO_PUBLIC_BOT_URL,
  appKey: process.env.EXPO_PUBLIC_APP_KEY,
  transport: process.env.EXPO_PUBLIC_TRANSPORT,
  iceServers: process.env.EXPO_PUBLIC_ICE_SERVERS,
};

/** Same formats as PIPECAT_ICE_SERVERS on the bot: comma-separated URLs or a JSON array. */
function parseIceServers(raw: string): IceServer[] {
  if (raw.startsWith("[")) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("must be a JSON array");
    return parsed as IceServer[];
  }
  return raw
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((urls) => ({ urls }));
}

function loadConfig(): { config: AppConfig | null; error: string | null } {
  const botUrl = env.botUrl?.trim().replace(/\/+$/, "");
  if (!botUrl) {
    return {
      config: null,
      error:
        "Thiếu EXPO_PUBLIC_BOT_URL. Tạo apps/mobile/.env từ .env.example rồi chạy lại Metro.",
    };
  }
  let iceServers: IceServer[] | null = null;
  const rawIce = env.iceServers?.trim();
  if (rawIce) {
    try {
      iceServers = parseIceServers(rawIce);
    } catch (err) {
      return {
        config: null,
        error: `EXPO_PUBLIC_ICE_SERVERS không hợp lệ: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  return {
    config: {
      botUrl,
      appKey: env.appKey?.trim() || null,
      transport: (env.transport?.trim() || "smallwebrtc") as TransportType,
      iceServers,
    },
    error: null,
  };
}

export const { config, error: configError } = loadConfig();
