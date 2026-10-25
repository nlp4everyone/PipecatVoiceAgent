import { useColorScheme } from "react-native";

export interface Theme {
  background: string;
  text: string;
  textMuted: string;
  textFaint: string;
  button: string;
  buttonActive: string;
  border: string;
  handle: string;
  bot: string;
  error: string;
  statusBar: "dark" | "light";
}

const light: Theme = {
  background: "#ffffff",
  text: "#111827",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  button: "#f3f4f6",
  buttonActive: "#d1d5db",
  border: "#e5e7eb",
  handle: "#d1d5db",
  bot: "#2563eb",
  error: "#dc2626",
  statusBar: "dark",
};

const dark: Theme = {
  background: "#0b0f19",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  textFaint: "#6b7280",
  button: "#1f2937",
  buttonActive: "#374151",
  border: "#1f2937",
  handle: "#4b5563",
  bot: "#60a5fa",
  error: "#f87171",
  statusBar: "light",
};

/** System light / dark palette (app.json: userInterfaceStyle "automatic"). */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
