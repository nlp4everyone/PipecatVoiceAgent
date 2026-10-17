// Âm báo ngắn khi bắt đầu / kết thúc cuộc gọi, tổng hợp bằng WebAudio nên không cần file âm thanh.

let context: AudioContext | null = null;

/** Gọi trong lúc người dùng bấm, nếu không trình duyệt sẽ giữ AudioContext ở trạng thái suspended. */
export function unlockChimes(): void {
  context ??= new AudioContext();
  void context.resume().catch(() => undefined);
}

function playNotes(frequencies: number[]): void {
  if (!context || context.state !== "running") return;
  const start = context.currentTime + 0.02;
  frequencies.forEach((frequency, i) => {
    const at = start + i * 0.11;
    const osc = context!.createOscillator();
    const gain = context!.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.08, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    osc.connect(gain).connect(context!.destination);
    osc.start(at);
    osc.stop(at + 0.4);
  });
}

export function playConnectChime(): void {
  playNotes([660, 880]);
}

export function playEndChime(): void {
  playNotes([660, 440]);
}
