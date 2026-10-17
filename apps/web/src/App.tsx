import { PipecatClientProvider } from "@pipecat-ai/client-react";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";

import { BotAudioOutput } from "@/components/pipecat/bot-audio";
import { VoiceScreen } from "@/components/voice-screen";
import { usePipecatApp } from "@/hooks/use-pipecat-app";

// Cùng tham số với client dựng sẵn ở /client của Pipecat runner:
// POST /start tạo session, rồi transport gửi WebRTC offer qua /sessions/{id}/api/offer.
const START_BOT_PARAMS = {
  endpoint: "/start",
  requestData: {
    createDailyRoom: false,
    enableDefaultIceServers: true,
    transport: "webrtc",
  },
};

export default function App() {
  const { client, connect, disconnect, error } = usePipecatApp({
    transportFactory: (options) => new SmallWebRTCTransport(options),
    transportOptions: { waitForICEGathering: true },
    startBotParams: START_BOT_PARAMS,
  });

  if (!client) {
    return <div className="h-dvh bg-background" />;
  }

  return (
    <PipecatClientProvider client={client}>
      <BotAudioOutput />
      <VoiceScreen onConnect={connect} onDisconnect={disconnect} error={error} />
    </PipecatClientProvider>
  );
}
