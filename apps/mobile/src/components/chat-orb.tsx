// Ported from apps/web/src/components/chat-orb.tsx; keep the shader and motion in sync.

import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";

import type { OrbState } from "@/hooks/use-voice-phase";

/** Cloud drift speed per state (shader time units per second). */
const DRIFT_SPEED: Record<OrbState, number> = {
  idle: 0.22,
  connecting: 0.4,
  listening: 0.3,
  thinking: 1.1,
  speaking: 0.45,
};

// Solid "sky" orb: blue base, white clouds drifting (fbm with domain warp),
// soft rim. Coordinates normalised to [-1, 1] by canvas height. Skia's y axis
// points down, so p.y is flipped to keep "dark on top, light at the bottom".
const ORB_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 uRes;
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

half4 main(float2 fragCoord) {
  vec2 p = (fragCoord * 2.0 - uRes) / uRes.y;
  p.y = -p.y;
  float r = length(p);
  float edge = 2.0 / uRes.y;
  float mask = 1.0 - smoothstep(0.98 - edge, 0.98, r);
  if (mask <= 0.0) {
    return half4(0.0);
  }

  // Slight bulge at the rim so the clouds read as lying on a sphere.
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec2 q = p / (0.55 + 0.45 * z) * 1.3;

  float t = uTime;
  vec2 warp = vec2(fbm(q + vec2(0.0, t * 0.5)), fbm(q + vec2(5.2, 1.3) - t * 0.35));
  float n = fbm(q + 1.8 * warp + vec2(t * 0.25, -t * 0.15));
  float clouds = smoothstep(0.42, 0.78, n + 0.12 * uLevel);

  vec3 deep = vec3(0.05, 0.40, 0.97);
  vec3 sky = vec3(0.40, 0.73, 1.0);
  vec3 white = vec3(0.97, 0.98, 1.0);

  // Deep blue on top, lighter towards the bottom, like looking up at the sky.
  vec3 col = mix(sky, deep, smoothstep(-0.9, 0.9, p.y));
  col = mix(col, white, clouds * (0.65 + 0.3 * smoothstep(0.6, -0.8, p.y)));

  float rim = smoothstep(0.55, 0.98, r);
  col = mix(col, col * 0.88, rim * 0.5 * (1.0 - uDark));
  col += sky * rim * 0.12 * uDark;
  col += uLevel * 0.06;

  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(gray), uMuted * 0.8);

  return half4(half3(col * mask), half(mask));
}
`);

interface ChatOrbProps {
  state: OrbState;
  /**
   * Latest audio level, 0..1, written from the JS thread whenever a new
   * reading arrives (~every 80 ms). The orb eases towards it every frame.
   */
  level: SharedValue<number>;
  /** Mic off: the orb fades to grey and slows down. */
  muted?: boolean;
  /** Diameter in dp. */
  size?: number;
}

/** ChatGPT Voice-style orb: drifting clouds inside, swells with `level`. */
export function ChatOrb({ state, level, muted = false, size = 240 }: ChatOrbProps) {
  const dark = useColorScheme() === "dark";
  const reducedMotion = useReducedMotion();

  // Props mirrored into shared values so the frame loop reads them on the UI thread.
  const stateSv = useSharedValue<OrbState>(state);
  const mutedSv = useSharedValue(muted ? 1 : 0);
  useEffect(() => {
    stateSv.value = state;
    mutedSv.value = muted ? 1 : 0;
  }, [state, muted, stateSv, mutedSv]);

  const smoothLevel = useSharedValue(0);
  const shaderTime = useSharedValue(Math.random() * 100);
  const scale = useSharedValue(1);
  const mutedMix = useSharedValue(0);

  useFrameCallback(({ timestamp, timeSincePreviousFrame }) => {
    "worklet";
    const dt = Math.min((timeSincePreviousFrame ?? 16) / 1000, 0.1);
    const seconds = timestamp / 1000;
    const current = stateSv.value;

    // Fast attack, slow release, as on the web. Coefficients are per frame at
    // 60 fps; scale them by dt so 120 Hz screens move at the same speed.
    const frames = dt * 60;
    const target = level.value;
    const k = target > smoothLevel.value ? 0.35 : 0.08;
    smoothLevel.value += (target - smoothLevel.value) * (1 - Math.pow(1 - k, frames));
    mutedMix.value +=
      (mutedSv.value - mutedMix.value) * (1 - Math.pow(0.9, frames));

    const drift =
      (DRIFT_SPEED[current] + smoothLevel.value * 1.2) * (1 - mutedMix.value * 0.7);
    shaderTime.value += dt * drift * (reducedMotion ? 0.3 : 1);

    let targetScale: number;
    switch (current) {
      case "connecting":
        targetScale = 0.9 + 0.04 * Math.sin(seconds * 3);
        break;
      case "thinking":
        targetScale = 0.95 + 0.02 * Math.sin(seconds * 5);
        break;
      case "speaking":
        targetScale = 1 + smoothLevel.value * 0.16;
        break;
      default:
        targetScale = 1 + 0.02 * Math.sin(seconds * 1.6);
    }
    if (reducedMotion) targetScale = 1 + (targetScale - 1) * 0.3;
    scale.value += (targetScale - scale.value) * (1 - Math.pow(0.85, frames));
  });

  const uniforms = useDerivedValue(() => ({
    uRes: [size, size],
    uTime: shaderTime.value,
    uLevel: smoothLevel.value,
    uDark: dark ? 1 : 0,
    uMuted: mutedMix.value,
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const box = { width: size, height: size, borderRadius: size / 2 };

  if (!ORB_SHADER) {
    // Shader failed to compile: static stand-in, like the web WebGL fallback.
    return <View style={[box, styles.fallback]} />;
  }

  return (
    <Animated.View style={[box, animatedStyle]}>
      <Canvas style={box}>
        <Fill>
          <Shader source={ORB_SHADER} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: "#66baff" },
});
