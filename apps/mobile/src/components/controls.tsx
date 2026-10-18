import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ConversationStatus } from "@/hooks/use-conversation";

interface ControlsProps {
  status: ConversationStatus;
  micEnabled: boolean;
  disabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMic: () => void;
}

export function Controls({
  status,
  micEnabled,
  disabled,
  onConnect,
  onDisconnect,
  onToggleMic,
}: ControlsProps) {
  if (status === "idle" || status === "error") {
    return (
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onConnect}
          style={({ pressed }) => [
            styles.start,
            (pressed || disabled) && styles.dimmed,
          ]}
        >
          <Text style={styles.startText}>
            {status === "error" ? "Thử lại" : "Bắt đầu"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={micEnabled ? "Tắt micro" : "Bật micro"}
        disabled={status !== "listening" && status !== "speaking"}
        onPress={onToggleMic}
        style={({ pressed }) => [
          styles.round,
          !micEnabled && styles.muted,
          pressed && styles.dimmed,
        ]}
      >
        <Text style={styles.icon}>{micEnabled ? "🎤" : "🔇"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kết thúc"
        onPress={onDisconnect}
        style={({ pressed }) => [
          styles.round,
          styles.end,
          pressed && styles.dimmed,
        ]}
      >
        <Text style={[styles.icon, styles.endIcon]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 48,
    paddingVertical: 24,
  },
  start: {
    backgroundColor: "#111827",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 999,
  },
  startText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { backgroundColor: "#fde68a" },
  end: { backgroundColor: "#ef4444" },
  icon: { fontSize: 26 },
  endIcon: { color: "#fff" },
  dimmed: { opacity: 0.5 },
});
