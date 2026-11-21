import { create } from "zustand";

import type { SettingsSection } from "../components/settings/settings-sections";

type SettingsState = {
  section: SettingsSection | undefined;
  open(section?: SettingsSection): void;
  close(): void;
};

export const useSettings = create<SettingsState>((set) => ({
  section: undefined,
  open: (section = "general") => set({ section }),
  close: () => set({ section: undefined }),
}));
