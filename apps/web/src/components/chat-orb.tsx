import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { createVisualizerAnalyser } from "@/lib/visualizer";

/** Trạng thái hiển thị của quả cầu, do màn hình gọi suy ra từ event RTVI. */
export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

interface ChatOrbProps {
  /** Track đang nói (bot hoặc mic). null thì quả cầu chỉ "thở". */
  track?: MediaStreamTrack | null;
  state: OrbState;
  /** Mic tắt: quả cầu nhạt màu và chậm lại. */
  muted?: boolean;
  /** Đường kính, px. */
  size?: number;
  className?: string;
}

/** Tốc độ trôi của mây theo trạng thái (đơn vị thời gian shader / giây). */
const DRIFT_SPEED: Record<OrbState, number> = {
  idle: 0.22,
  connecting: 0.4,
  listening: 0.3,
  thinking: 1.1,
  speaking: 0.45,
};

const VERTEX_SHADER = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Quả cầu đặc kiểu "bầu trời": nền xanh, mây trắng trôi (fbm có domain warp),
// viền mềm. Toạ độ chuẩn hoá về [-1, 1] theo chiều cao canvas.
const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevel;
uniform float uDark;
uniform float uMuted;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  float r = length(p);
  float edge = 3.0 / uRes.y;
  float mask = 1.0 - smoothstep(0.98 - edge, 0.98, r);
  if (mask <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Phồng nhẹ ở viền để mây trông như phủ trên mặt cầu.
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec2 q = p / (0.55 + 0.45 * z) * 1.3;

  float t = uTime;
  vec2 warp = vec2(fbm(q + vec2(0.0, t * 0.5)), fbm(q + vec2(5.2, 1.3) - t * 0.35));
  float n = fbm(q + 1.8 * warp + vec2(t * 0.25, -t * 0.15));
  float clouds = smoothstep(0.42, 0.78, n + 0.12 * uLevel);

  vec3 deep = vec3(0.05, 0.40, 0.97);
  vec3 sky = vec3(0.40, 0.73, 1.0);
  vec3 white = vec3(0.97, 0.98, 1.0);

  // Trên xanh đậm, dưới sáng dần như nhìn bầu trời từ dưới lên.
  vec3 col = mix(sky, deep, smoothstep(-0.9, 0.9, p.y));
  col = mix(col, white, clouds * (0.65 + 0.3 * smoothstep(0.6, -0.8, p.y)));

  float rim = smoothstep(0.55, 0.98, r);
  col = mix(col, col * 0.88, rim * 0.5 * (1.0 - uDark));
  col += sky * rim * 0.12 * uDark;
  col += uLevel * 0.06;

  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(gray), uMuted * 0.8);

  gl_FragColor = vec4(col * mask, mask);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("ChatOrb shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Quả cầu kiểu ChatGPT Voice: mây trôi bên trong, phình theo âm lượng của `track`. */
export function ChatOrb({ track = null, state, muted = false, size = 260, className }: ChatOrbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stateRef = useRef(state);
  const mutedRef = useRef(muted);
  const [webglFailed, setWebglFailed] = useState(false);

  // Vòng render đọc giá trị mới nhất qua ref, khỏi khởi tạo lại WebGL mỗi lần đổi trạng thái.
  useEffect(() => {
    stateRef.current = state;
    mutedRef.current = muted;
  }, [state, muted]);

  useEffect(() => {
    if (!track) return;
    const { analyser, dispose } = createVisualizerAnalyser(track);
    analyserRef.current = analyser;
    return () => {
      analyserRef.current = null;
      dispose();
    };
  }, [track]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
    const vs = gl && compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl && vs && fs ? gl.createProgram() : null;
    if (!gl || !program) {
      setWebglFailed(true);
      return;
    }
    gl.attachShader(program, vs!);
    gl.attachShader(program, fs!);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglFailed(true);
      return;
    }
    gl.useProgram(program);

    // Một tam giác phủ kín viewport.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uLevel = gl.getUniformLocation(program, "uLevel");
    const uDark = gl.getUniformLocation(program, "uDark");
    const uMuted = gl.getUniformLocation(program, "uMuted");
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let samples = new Float32Array(0);
    let level = 0;
    let shaderTime = Math.random() * 100;
    let scale = 1;
    let mutedMix = 0;
    let last = performance.now();
    let frame = 0;

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const seconds = now / 1000;
      const current = stateRef.current;

      // Âm lượng = RMS của dạng sóng, có attack nhanh / release chậm để không giật.
      let target = 0;
      const analyser = analyserRef.current;
      if (analyser) {
        if (samples.length !== analyser.fftSize) samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        const rms = Math.sqrt(sum / samples.length);
        target = Math.min(1, Math.max(0, (rms - 0.008) * 7));
      }
      level += (target - level) * (target > level ? 0.35 : 0.08);
      mutedMix += ((mutedRef.current ? 1 : 0) - mutedMix) * 0.1;

      const drift = (DRIFT_SPEED[current] + level * 1.2) * (1 - mutedMix * 0.7);
      shaderTime += dt * drift * (reducedMotion ? 0.3 : 1);

      let targetScale: number;
      switch (current) {
        case "connecting":
          targetScale = 0.9 + 0.04 * Math.sin(seconds * 3);
          break;
        case "thinking":
          targetScale = 0.95 + 0.02 * Math.sin(seconds * 5);
          break;
        case "speaking":
          targetScale = 1 + level * 0.16;
          break;
        default:
          targetScale = 1 + 0.02 * Math.sin(seconds * 1.6);
      }
      if (reducedMotion) targetScale = 1 + (targetScale - 1) * 0.3;
      scale += (targetScale - scale) * 0.15;
      wrapper.style.transform = `scale(${scale.toFixed(4)})`;

      gl.uniform1f(uTime, shaderTime);
      gl.uniform1f(uLevel, level);
      gl.uniform1f(uDark, document.documentElement.classList.contains("dark") ? 1 : 0);
      gl.uniform1f(uMuted, mutedMix);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs!);
      gl.deleteShader(fs!);
    };
  }, [size]);

  return (
    <div
      ref={wrapperRef}
      className={cn("rounded-full will-change-transform", className)}
      style={{
        width: size,
        height: size,
        // Không có WebGL: quả cầu tĩnh bằng gradient.
        background: webglFailed
          ? "radial-gradient(circle at 50% 75%, #f5f9ff 0%, #66baff 45%, #0d66f7 100%)"
          : undefined,
      }}
    >
      <canvas ref={canvasRef} className="size-full rounded-full" aria-hidden />
    </div>
  );
}
