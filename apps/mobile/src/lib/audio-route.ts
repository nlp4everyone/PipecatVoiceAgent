import { type PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";

// Device ids of the Daily media manager (react-native-webrtc, DailyDevicesManager).
const SPEAKERPHONE = "SPEAKERPHONE";
const WIRED_OR_EARPIECE = "WIRED_OR_EARPIECE";
const BLUETOOTH = "BLUETOOTH";

/**
 * Loudspeaker by default (earpiece on a phone is too quiet for a voice agent);
 * switch to Bluetooth or a wired headset while one is connected, and back to the
 * loudspeaker when it is removed. The native module only reports that the route
 * changed; it never switches on its own.
 */
function pickOutput(devices: MediaDeviceInfo[]): string {
  if (devices.some((d) => d.deviceId === BLUETOOTH)) return BLUETOOTH;
  // The same id is "Phone earpiece" without a headset and "Wired headset" with one.
  if (
    devices.some(
      (d) => d.deviceId === WIRED_OR_EARPIECE && d.label === "Wired headset",
    )
  )
    return WIRED_OR_EARPIECE;
  return SPEAKERPHONE;
}

export function routeAudioOutput(client: PipecatClient) {
  let applied: string | null = null;

  const apply = (devices: MediaDeviceInfo[]) => {
    const wanted = pickOutput(devices);
    if (wanted === applied) return; // our own switch also fires a route change
    applied = wanted;
    client.updateSpeaker(wanted);
  };

  client.on(RTVIEvent.Connected, () => {
    applied = null;
    client.getAllSpeakers().then(apply, () => {
      applied = SPEAKERPHONE;
      client.updateSpeaker(SPEAKERPHONE);
    });
  });
  client.on(RTVIEvent.AvailableSpeakersUpdated, apply);
}
