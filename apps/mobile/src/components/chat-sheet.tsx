import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { type Theme, useTheme } from "@/lib/theme";

interface ChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Distance kept free at the bottom (the button row). */
  bottomInset: number;
  children: ReactNode;
}

const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 700;

/** Bottom sheet over the lower half of the screen; drag the handle down to close. */
export function ChatSheet({
  open,
  onOpenChange,
  bottomInset,
  children,
}: ChatSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { height } = useWindowDimensions();
  // Further down than the sheet is tall, so the closed sheet is off-screen.
  const hidden = height * 0.6;
  const translateY = useSharedValue(hidden);

  useEffect(() => {
    translateY.value = withTiming(open ? 0 : hidden, { duration: 260 });
  }, [open, hidden, translateY]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        scheduleOnRN(onOpenChange, false);
      } else {
        translateY.value = withTiming(0, { duration: 180 });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.sheet, { bottom: bottomInset }, style]}
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      <GestureDetector gesture={drag}>
        <View style={styles.header} accessibilityLabel="Hội thoại">
          <View style={styles.handle} />
          <Text style={styles.title}>Hội thoại</Text>
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "45%",
      backgroundColor: t.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 8,
    },
    header: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.handle,
      marginBottom: 8,
    },
    title: { fontSize: 15, fontWeight: "600", color: t.text },
  });
