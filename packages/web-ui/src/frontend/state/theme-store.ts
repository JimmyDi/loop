import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";

export type ThemePreference = "light" | "dark" | "system";

type ThemeState = {
  theme: ThemePreference;
  setTheme(theme: ThemePreference): void;
};

const saved = readPreference<unknown>("theme", "system");

const applyTheme = (theme: ThemePreference): void => {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
};

export const useTheme = create<ThemeState>((set) => ({
  theme: saved === "light" || saved === "dark" ? saved : "system",
  setTheme: (theme) => {
    applyTheme(theme);
    writePreference("theme", theme);
    set({ theme });
  },
}));

// Applied before React renders. CSS color-scheme follows browser changes in System mode.
export const initializeTheme = (): void => applyTheme(useTheme.getState().theme);
