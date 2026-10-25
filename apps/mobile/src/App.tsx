import {
  type APIRequest,
  type PipecatClient,
  RTVIEvent,
  type TransportConnectionParams,
} from "@pipecat-ai/client-js";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ChatOrb } from "@/components/chat-orb";
import { Controls } from "@/components/controls";
import { Transcript } from "@/components/transcript";
import { type AppConfig, config, configError } from "@/lib/config";
import { useConversation } from "@/hooks/use-conversation";
import { useOrbLevel } from "@/hooks/use-orb-level";
import { usePipecatApp } from "@/hooks/use-pipecat-app";
import { useVoicePhase } from "@/hooks/use-voice-phase";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.screen}>
        {config ? (
          <VoiceScreen config={config} />
        ) : (
          <Text style={[styles.error, styles.configError]}>{configError}</Text>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function VoiceScreen({ config }: { config: AppConfig }) {
  // Same request as the web app (apps/web/src/App.tsx), so the bot needs no
  // changes. The transport derives the offer URL from this endpoint:
  // .../start -> .../sessions/{id}/api/offer, reusing the same headers.
  const startBotParams: APIRequest = {
    endpoint: `${config.botUrl}/start`,
    requestData: {
      createDailyRoom: false,
      enableDefaultIceServers: true,
      transport: "webrtc",
    },
    ...(config.appKey && {
      headers: new Headers({ "X-App-Key": config.appKey }),
    }),
  };

  const { client, connect, disconnect, error } = usePipecatApp({
    transportType: config.transport,
    transportOptions: {
      waitForICEGathering: true,
      ...(config.iceServers && { iceServers: config.iceServers }),
    },
    startBotParams,
    // EXPO_PUBLIC_ICE_SERVERS, when set, wins over the bot's iceConfig.
    startBotResponseTransformer: config.iceServers
      ? (response) =>
          ({
            ...(response as object),
            iceConfig: { iceServers: config.iceServers },
          }) as TransportConnectionParams
      : undefined,
    onClient: routeAudioToSpeaker,
  });

  const { transportState, messages, micEnabled, toggleMic } =
    useConversation(client);
  const voice = useVoicePhase(client, transportState, micEnabled);
  const orbLevel = useOrbLevel(client, voice.levelSource);
  const failed = !voice.inCall && (!!error || transportState === "error");

  const [captionsOn, setCaptionsOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  const start = () => void connect();

  // One line under the orb at most: start hint, or mic-off notice (like web).
  const hint = failed
    ? null
    : !voice.inCall
      ? "Chạm để bắt đầu trò chuyện"
      : voice.muted
        ? "Micro đang tắt"
        : null;

  // Bot captions, hidden while the user holds the turn (like web). Step 2.5
  // replaces this with word-by-word captions and a remembered CC setting.
  const lastMessage = messages.at(-1);
  const caption =
    captionsOn &&
    voice.isReady &&
    voice.phase !== "userSpeaking" &&
    voice.phase !== "thinking" &&
    lastMessage?.role === "bot"
      ? lastMessage.text
      : "";

  return (
    <View style={styles.screen}>
      <View style={styles.stage}>
        <Pressable
          onPress={start}
          disabled={voice.inCall || !client}
          accessibilityRole={voice.inCall ? undefined : "button"}
          accessibilityLabel={
            voice.inCall ? voice.statusLabel : "Bắt đầu trò chuyện"
          }
          accessibilityLiveRegion="polite"
        >
          <ChatOrb state={voice.orbState} level={orbLevel} muted={voice.muted} />
        </Pressable>

        <View style={styles.below}>
          {hint && <Text style={styles.hint}>{hint}</Text>}
          {!!caption && (
            <Text style={styles.caption} numberOfLines={4}>
              {caption}
            </Text>
          )}
          {failed && (
            <Pressable
              onPress={start}
              accessibilityRole="button"
              accessibilityLabel="Lỗi kết nối. Chạm để thử lại"
              style={styles.errorBox}
            >
              <Text style={styles.error}>Không kết nối được. Chạm để thử lại.</Text>
              {error && (
                <Text style={styles.errorDetail} numberOfLines={2}>
                  {error}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        {voice.inCall && (
          <Controls
            isReady={voice.isReady}
            micEnabled={micEnabled}
            captionsOn={captionsOn}
            chatOpen={chatOpen}
            onToggleCaptions={() => setCaptionsOn((v) => !v)}
            onToggleChat={() => setChatOpen((v) => !v)}
            onToggleMic={toggleMic}
            onDisconnect={() => void disconnect()}
          />
        )}
      </View>

      {/* Step 2.5 turns this into a swipeable bottom sheet. */}
      {voice.inCall && chatOpen && (
        <View style={styles.chat}>
          <Text style={styles.chatTitle}>Hội thoại</Text>
          <Transcript messages={messages} />
        </View>
      )}
    </View>
  );
}

/** Bot audio defaults to the earpiece on phones; use the loudspeaker instead. */
function routeAudioToSpeaker(client: PipecatClient) {
  client.on(RTVIEvent.Connected, () => client.updateMic("SPEAKERPHONE"));
}

const FOOTER_HEIGHT = 112;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    paddingHorizontal: 16,
  },
  below: {
    minHeight: 112,
    width: "100%",
    maxWidth: 560,
    alignItems: "center",
    gap: 8,
  },
  hint: { fontSize: 15, color: "#6b7280" },
  caption: {
    fontSize: 20,
    lineHeight: 28,
    color: "#111827",
    textAlign: "center",
  },
  errorBox: { alignItems: "center", gap: 4, paddingHorizontal: 16 },
  error: { color: "#dc2626", fontSize: 15, textAlign: "center" },
  errorDetail: { color: "#9ca3af", fontSize: 12, textAlign: "center" },
  configError: { marginTop: 48, paddingHorizontal: 16 },
  footer: {
    height: FOOTER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
  },
  chat: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "45%",
    bottom: FOOTER_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
});
