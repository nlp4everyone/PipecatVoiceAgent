import { useCallback, useEffect, useRef } from "react";
import { MathUtils } from "three";

import { createVisualizerAnalyser } from "@/lib/visualizer";

export const VISEMES = ["aa", "ih", "ou", "ee", "oh"] as const;
export type Viseme = (typeof VISEMES)[number];
export type Mouth = Record<Viseme, number>;

// Dải tần của giọng nói (Hz): thấp ~ F1 của o/u, giữa ~ a, cao ~ F2 của e/i.
const LOW_HZ = 200;
const MID_HZ = 700;
const HIGH_HZ = 1800;
const TOP_HZ = 4000;

// Năng lượng trung bình (0–1) dưới ngưỡng thì coi là im lặng, trên ngưỡng đầy thì miệng mở hết cỡ.
// Các hằng số này là giá trị ban đầu, tinh chỉnh ở bước 2.4 với giọng thật.
const NOISE_FLOOR = 0.12;
const FULL_LEVEL = 0.5;
// Giới hạn tổng độ mở: miệng mở quá lố sẽ lộ ngay trên nhân vật đầu to.
const MAX_OPEN = 0.7;
// Tấn công nhanh, thả chậm (đơn vị: tốc độ `damp`).
const ATTACK = 35;
const RELEASE = 12;

const SILENT: Mouth = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

/** Trung bình các bin trong [fromHz, toHz), thang 0–1. */
function bandLevel(spectrum: Uint8Array, binHz: number, fromHz: number, toHz: number) {
  const from = Math.max(0, Math.floor(fromHz / binHz));
  const to = Math.min(spectrum.length, Math.max(from + 1, Math.ceil(toHz / binHz)));
  let sum = 0;
  for (let i = from; i < to; i++) sum += spectrum[i] ?? 0;
  return sum / (to - from) / 255;
}

/**
 * Từ phổ âm thanh suy ra hình miệng đích. Biên độ chung quyết định mức mở;
 * dải nào mạnh hơn quyết định hình: thấp → o/u, giữa → a, cao → e/i.
 */
export function mouthTargets(spectrum: Uint8Array, binHz: number, out: Mouth): Mouth {
  const low = bandLevel(spectrum, binHz, LOW_HZ, MID_HZ);
  const mid = bandLevel(spectrum, binHz, MID_HZ, HIGH_HZ);
  const high = bandLevel(spectrum, binHz, HIGH_HZ, TOP_HZ);
  const level = bandLevel(spectrum, binHz, LOW_HZ, TOP_HZ);

  const open = MathUtils.clamp((level - NOISE_FLOOR) / (FULL_LEVEL - NOISE_FLOOR), 0, 1) * MAX_OPEN;
  const total = low + mid + high || 1;
  const l = low / total;
  const m = mid / total;
  const h = high / total;

  out.aa = open * m;
  out.oh = open * l * 0.6;
  out.ou = open * l * 0.4;
  out.ee = open * h * 0.6;
  out.ih = open * h * 0.4;
  return out;
}

/**
 * Trả về hàm `sample(dt)`: gọi mỗi khung vẽ, cho ra độ mở của từng hình miệng
 * (đã làm mượt) theo giọng trong `track`. Không có track thì miệng khép dần.
 * Kết quả là một object dùng lại giữa các lần gọi, đừng giữ tham chiếu qua khung sau.
 */
export function useAvatarLipsync(track: MediaStreamTrack | null | undefined) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const spectrumRef = useRef<Uint8Array>(new Uint8Array(0));
  const targetRef = useRef<Mouth>({ ...SILENT });
  const mouthRef = useRef<Mouth>({ ...SILENT });

  useEffect(() => {
    if (!track) return;
    const { analyser, dispose } = createVisualizerAnalyser(track);
    // iOS Safari có thể để AudioContext ở trạng thái suspended nếu tạo ngoài thao tác người dùng.
    void (analyser.context as AudioContext).resume();
    analyserRef.current = analyser;
    spectrumRef.current = new Uint8Array(analyser.frequencyBinCount);
    return () => {
      analyserRef.current = null;
      dispose();
    };
  }, [track]);

  return useCallback((dt: number): Mouth => {
    const analyser = analyserRef.current;
    const target = targetRef.current;
    if (analyser) {
      analyser.getByteFrequencyData(spectrumRef.current as Uint8Array<ArrayBuffer>);
      mouthTargets(spectrumRef.current, analyser.context.sampleRate / analyser.fftSize, target);
    } else {
      Object.assign(target, SILENT);
    }
    const mouth = mouthRef.current;
    for (const v of VISEMES) {
      mouth[v] = MathUtils.damp(mouth[v], target[v], target[v] > mouth[v] ? ATTACK : RELEASE, dt);
    }
    return mouth;
  }, []);
}
