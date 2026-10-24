import {
  type APIRequest,
  type PipecatClient,
  RTVIEvent,
  type TransportConnectionParams,
} from "@pipecat-ai/client-js";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { Controls } from "@/components/controls";
import { StatusIndicator } from "@/components/status-indicator";
import { Transcript } from "@/components/transcript";
import { type AppConfig, config, configError } from "@/lib/config";
import { useConversation } from "@/hooks/use-conversation";
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
    onClient: (client) => {
      routeAudioToSpeaker(client);
      if (__DEV__) logAudioLevelRate(client);
    },
  });

  const { transportState, messages, micEnabled, toggleMic } =
    useConversation(client);
  const voice = useVoicePhase(client, transportState, micEnabled);
  const failed = !voice.inCall && (!!error || transportState === "error");

  // Temporary check for step 2.2; remove once verified (docs/plans/mobile-app/phase-2.md).
  useEffect(() => {
    if (__DEV__) console.log(`[phase] ${voice.phase} -> orb ${voice.orbState}`);
  }, [voice.phase, voice.orbState]);

  return (
    <View style={styles.screen}>
      <Transcript messages={messages} />
      <StatusIndicator
        orbState={voice.orbState}
        label={failed ? "Lỗi kết nối" : voice.statusLabel}
        muted={voice.muted}
      />
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

/** Temporary check for step 2.1: expect ~12 updates/s per side, not 2. */
function logAudioLevelRate(client: PipecatClient) {
  let local = 0;
  let remote = 0;
  client.on(RTVIEvent.LocalAudioLevel, () => local++);
  client.on(RTVIEvent.RemoteAudioLevel, () => remote++);
  setInterval(() => {
    if (local || remote) {
      console.log(`[audio-level] local ${local / 5}/s, remote ${remote / 5}/s`);
    }
    local = 0;
    remote = 0;
  }, 5000);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  error: { color: "#dc2626", textAlign: "center", paddingHorizontal: 16 },
  configError: { marginTop: 48 },
});
