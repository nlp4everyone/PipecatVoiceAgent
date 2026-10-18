import { StyleSheet, Text, View } from "react-native";

import type { ConversationStatus } from "@/hooks/use-conversation";

const LABELS: Record<ConversationStatus, string> = {
  idle: "Đã ngắt kết nối",
  connecting: "Đang kết nối…",
  listening: "Đang nghe…",
  speaking: "Bot đang nói",
  error: "Lỗi kết nối",
};

const COLORS: Record<ConversationStatus, string> = {
  idle: "#9ca3af",
  connecting: "#f59e0b",
  listening: "#22c55e",
  speaking: "#3b82f6",
  error: "#ef4444",
};

export function StatusIndicator({ status }: { status: ConversationStatus }) {
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: COLORS[status] }]} />
      <Text style={styles.label}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 12, paddingVertical: 16 },
  dot: { width: 56, height: 56, borderRadius: 28 },
  label: { fontSize: 17, color: "#374151" },
});
