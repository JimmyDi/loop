import { expect, test, vi } from "vitest";

import { activateAccountPreferences } from "./account-preferences";
import { readPreference, setPreferenceUser } from "./preferences";
import { useWorkspace } from "../state/workspace-store";
import { useSessions } from "../state/session-store";

test("switching accounts restores only that user's drafts and clears session memory", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const previous = useWorkspace.getState();
  try {
    activateAccountPreferences("first");
    useWorkspace.getState().draft("chat", "Synthetic private draft");
    useSessions.setState({ views: { chat: { connected: false } } });
    activateAccountPreferences("second");
    expect(useWorkspace.getState().drafts).toEqual({});
    expect(useSessions.getState().views).toEqual({});
    useWorkspace.getState().draft("chat", "Second draft");
    activateAccountPreferences("first");
    expect(readPreference("drafts", {})).toEqual({ chat: "Synthetic private draft" });
    expect(useWorkspace.getState().drafts.chat).toBe("Synthetic private draft");
    activateAccountPreferences();
    expect(useWorkspace.getState().drafts).toEqual({});
  } finally {
    setPreferenceUser();
    useWorkspace.setState(previous, true);
    vi.unstubAllGlobals();
  }
});
