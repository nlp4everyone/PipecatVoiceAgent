import {
  type APIRequest,
  type PipecatClient,
  RTVIEvent,
  type TransportConnectionParams,
} from "@pipecat-ai/client-js";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ChatOrb } from "@/components/chat-orb";
import { ChatSheet } from "@/components/chat-sheet";
import { Controls } from "@/components/controls";
import { Transcript } from "@/components/transcript";
import { type AppConfig, config, configError } from "@/lib/config";
import { type Theme, useTheme } from "@/lib/theme";
import { useConversation } from "@/hooks/use-conversation";
import { useCallFeedback } from "@/hooks/use-call-feedback";
import { useCaptionsSetting } from "@/hooks/use-captions-setting";
import { useOrbLevel } from "@/hooks/use-orb-level";
import { usePipecatApp } from "@/hooks/use-pipecat-app";
import { useVoicePhase } from "@/hooks/use-voice-phase";

export default function App() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaProvider>
        <StatusBar style={theme.statusBar} />
        <SafeAreaView style={styles.screen}>
          {config ? (
            <VoiceScreen config={config} />
          ) : (
            <Text style={[styles.error, styles.configError]}>
              {configError}
            </Text>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function VoiceScreen({ config }: { config: AppConfig }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  useCallFeedback(transportState, voice.inCall);
  const orbLevel = useOrbLevel(client, voice.levelSource);
  const failed = !voice.inCall && (!!error || transportState === "error");

  // Orb scales with the screen; the text block hangs below it without moving it.
  const { width } = useWindowDimensions();
  const orbSize = Math.min(width * 0.6, 280);
  const belowWidth = Math.min(width - 32, 560);

  const { captionsOn, toggleCaptions } = useCaptionsSetting();
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

  // Bot captions grow word by word (BotOutput) and show the sentence being
  // spoken; hidden while the user holds the turn (like web).
  const lastMessage = messages.at(-1);
  const caption =
    captionsOn &&
    voice.isReady &&
    voice.phase !== "userSpeaking" &&
    voice.phase !== "thinking" &&
    lastMessage?.role === "bot"
      ? lastSentence(lastMessage.text)
      : "";

  // Swipe up anywhere on the stage to open the conversation sheet.
  const openChat = Gesture.Pan()
    .enabled(voice.inCall && !chatOpen)
    .activeOffsetY([-20, 20])
    .failOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationY < -60 || e.velocityY < -600)
        scheduleOnRN(setChatOpen, true);
    });

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={openChat}>
        <View style={styles.stage}>
          <View style={{ width: orbSize, height: orbSize }}>
            <Pressable
              onPress={start}
              disabled={voice.inCall || !client}
              accessibilityRole={voice.inCall ? undefined : "button"}
              accessibilityLabel={
                voice.inCall ? voice.statusLabel : "Bắt đầu trò chuyện"
              }
              accessibilityLiveRegion="polite"
            >
              <ChatOrb
                state={voice.orbState}
                level={orbLevel}
                muted={voice.muted}
                size={orbSize}
              />
            </Pressable>

            <View
              style={[
                styles.below,
                { width: belowWidth, left: (orbSize - belowWidth) / 2 },
              ]}
            >
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
                  <Text style={styles.error}>
                    Không kết nối được. Chạm để thử lại.
                  </Text>
                  {error && (
                    <Text style={styles.errorDetail} numberOfLines={2}>
                      {error}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        {voice.inCall && (
          <Controls
            isReady={voice.isReady}
            micEnabled={micEnabled}
            captionsOn={captionsOn}
            chatOpen={chatOpen}
            onToggleCaptions={toggleCaptions}
            onToggleChat={() => setChatOpen((v) => !v)}
            onToggleMic={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleMic();
            }}
            onDisconnect={() => void disconnect()}
          />
        )}
      </View>

      <ChatSheet
        open={voice.inCall && chatOpen}
        onOpenChange={setChatOpen}
        bottomInset={FOOTER_HEIGHT}
      >
        <Transcript messages={messages} />
      </ChatSheet>
    </View>
  );
}

/** The sentence currently being spoken (captions show one at a time). */
function lastSentence(text: string) {
  const sentences = text.trim().split(/(?<=[.!?…])\s+/);
  return sentences.at(-1) ?? "";
}

/** Bot audio defaults to the earpiece on phones; use the loudspeaker instead. */
function routeAudioToSpeaker(client: PipecatClient) {
  client.on(RTVIEvent.Connected, () => client.updateMic("SPEAKERPHONE"));
}

const FOOTER_HEIGHT = 112;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    stage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      // Offsets the footer so the orb sits at the centre of the whole screen.
      paddingTop: FOOTER_HEIGHT,
    },
    below: {
      position: "absolute",
      top: "100%",
      marginTop: 32,
      alignItems: "center",
      gap: 8,
    },
    hint: { fontSize: 15, color: t.textMuted },
    caption: {
      fontSize: 20,
      lineHeight: 28,
      color: t.text,
      textAlign: "center",
    },
    errorBox: { alignItems: "center", gap: 4, paddingHorizontal: 16 },
    error: { color: t.error, fontSize: 15, textAlign: "center" },
    errorDetail: { color: t.textFaint, fontSize: 12, textAlign: "center" },
    configError: { marginTop: 48, paddingHorizontal: 16 },
    footer: {
      height: FOOTER_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 16,
    },
  });
