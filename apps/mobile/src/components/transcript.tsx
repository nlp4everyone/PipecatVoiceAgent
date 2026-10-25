import { useMemo, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import type { ConversationMessage } from "@/hooks/use-conversation";
import { type Theme, useTheme } from "@/lib/theme";

export function Transcript({ messages }: { messages: ConversationMessage[] }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const listRef = useRef<FlatList<ConversationMessage>>(null);
  // A bot bubble exists from the first "new" segment, before any word is spoken.
  const visible = messages.filter((m) => m.text);

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={(m) => m.id}
      onContentSizeChange={() =>
        listRef.current?.scrollToEnd({ animated: true })
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          Lời bạn nói và bot trả lời sẽ hiện ở đây.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={[styles.speaker, item.role === "bot" && styles.bot]}>
            {item.role === "user" ? "Bạn" : "Bot"}
          </Text>
          <Text style={styles.text}>{item.text}</Text>
        </View>
      )}
    />
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    list: { flex: 1 },
    content: { padding: 16, gap: 12, flexGrow: 1 },
    empty: { color: t.textFaint, textAlign: "center", marginTop: 32 },
    row: { flexDirection: "row", gap: 8 },
    speaker: { fontWeight: "600", color: t.text, width: 36 },
    bot: { color: t.bot },
    text: { flex: 1, fontSize: 16, lineHeight: 22, color: t.text },
  });
