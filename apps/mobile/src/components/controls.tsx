import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ControlsProps {
  isReady: boolean;
  micEnabled: boolean;
  captionsOn: boolean;
  chatOpen: boolean;
  onToggleCaptions: () => void;
  onToggleChat: () => void;
  onToggleMic: () => void;
  onDisconnect: () => void;
}

/** In-call button row: captions · conversation · mic · end (like the web footer). */
export function Controls({
  isReady,
  micEnabled,
  captionsOn,
  chatOpen,
  onToggleCaptions,
  onToggleChat,
  onToggleMic,
  onDisconnect,
}: ControlsProps) {
  return (
    <View style={styles.row}>
      <RoundButton
        label={captionsOn ? "Tắt phụ đề" : "Bật phụ đề"}
        active={!captionsOn}
        onPress={onToggleCaptions}
      >
        <Text style={[styles.cc, !captionsOn && styles.ccOff]}>CC</Text>
      </RoundButton>
      <RoundButton
        label={chatOpen ? "Ẩn hội thoại" : "Xem hội thoại"}
        active={chatOpen}
        onPress={onToggleChat}
      >
        <Text style={styles.icon}>💬</Text>
      </RoundButton>
      <RoundButton
        label={micEnabled ? "Tắt micro" : "Bật micro"}
        active={!micEnabled}
        disabled={!isReady}
        onPress={onToggleMic}
      >
        <Text style={styles.icon}>{micEnabled ? "🎤" : "🔇"}</Text>
      </RoundButton>
      <RoundButton label="Kết thúc" variant="end" onPress={onDisconnect}>
        <Text style={[styles.icon, styles.endIcon]}>✕</Text>
      </RoundButton>
    </View>
  );
}

interface RoundButtonProps {
  label: string;
  onPress: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "end";
}

function RoundButton({
  label,
  onPress,
  children,
  active = false,
  disabled = false,
  variant = "default",
}: RoundButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        active && styles.active,
        variant === "end" && styles.end,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  round: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  active: { backgroundColor: "#d1d5db" },
  end: { backgroundColor: "#ef4444" },
  icon: { fontSize: 24 },
  endIcon: { color: "#fff", fontWeight: "600" },
  cc: { fontSize: 16, fontWeight: "700", color: "#111827" },
  ccOff: { color: "#9ca3af", textDecorationLine: "line-through" },
  dimmed: { opacity: 0.4 },
});
