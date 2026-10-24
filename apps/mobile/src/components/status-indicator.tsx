import { StyleSheet, Text, View } from "react-native";

import type { OrbState } from "@/hooks/use-voice-phase";

// Stand-in for the orb until step 2.3.
const COLORS: Record<OrbState, string> = {
  idle: "#9ca3af",
  connecting: "#f59e0b",
  listening: "#22c55e",
  thinking: "#a855f7",
  speaking: "#3b82f6",
};

interface StatusIndicatorProps {
  orbState: OrbState;
  label: string;
  muted: boolean;
}

export function StatusIndicator({ orbState, label, muted }: StatusIndicatorProps) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: COLORS[orbState] },
          muted && styles.muted,
        ]}
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 12, paddingVertical: 16 },
  dot: { width: 56, height: 56, borderRadius: 28 },
  muted: { opacity: 0.4 },
  label: { fontSize: 17, color: "#374151" },
});
