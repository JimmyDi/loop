import { create } from "zustand";

import { environment } from "../lib/environment";
import { readPreference, writePreference } from "../lib/preferences";

type DebugState = {
  openUiDevtools: boolean;
  setOpenUiDevtools(enabled: boolean): void;
};

export const useDebug = create<DebugState>((set) => ({
  openUiDevtools:
    environment === "local-dev" && readPreference<unknown>("openUiDevtools", true) !== false,
  setOpenUiDevtools: (enabled) => {
    if (environment !== "local-dev") return;
    writePreference("openUiDevtools", enabled);
    set({ openUiDevtools: enabled });
  },
}));
