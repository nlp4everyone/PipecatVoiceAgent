import {
  type APIRequest,
  type PipecatClient,
  RTVIEvent,
  type TransportConnectionParams,
} from "@pipecat-ai/client-js";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
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

  return (
    <View style={styles.screen}>
      <Transcript messages={messages} />
      <View
        style={styles.orb}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={failed ? "Lỗi kết nối" : voice.statusLabel}
      >
        <ChatOrb state={voice.orbState} level={orbLevel} muted={voice.muted} />
        <Text style={styles.label}>
          {failed ? "Lỗi kết nối" : voice.statusLabel}
        </Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Controls
        inCall={voice.inCall}
        isReady={voice.isReady}
        failed={failed}
        micEnabled={micEnabled}
        disabled={!client}
        onConnect={() => void connect()}
        onDisconnect={() => void disconnect()}
        onToggleMic={toggleMic}
      />
    </View>
  );
}

/** Bot audio defaults to the earpiece on phones; use the loudspeaker instead. */
function routeAudioToSpeaker(client: PipecatClient) {
  client.on(RTVIEvent.Connected, () => client.updateMic("SPEAKERPHONE"));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  error: { color: "#dc2626", textAlign: "center", paddingHorizontal: 16 },
  configError: { marginTop: 48 },
  orb: { alignItems: "center", gap: 16, paddingVertical: 16 },
  label: { fontSize: 17, color: "#374151" },
});
