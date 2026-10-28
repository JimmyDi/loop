import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { useWorkspace } from "../state/workspace-store";
import type { VoiceControl } from "./voice-hook-types";
import { useVoiceDictation } from "./useVoiceDictation";

test("discard invalidates pending finalization and a new recording only appends its own text", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const original = useWorkspace.getState();
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const pending = Promise.withResolvers<void>();
  const voice = {
    endInput: vi.fn(() => pending.promise),
    stop: vi.fn(async () => {}),
  } as unknown as VoiceControl;
  try {
    useWorkspace.setState({ drafts: { sample: "Existing" } });
    const { result } = renderHook(() => useVoiceDictation("sample"));
    act(() => result.current.begin());
    act(() => result.current.transcript("Discarded", true, "one"));
    let finishing: Promise<void> | undefined;
    act(() => {
      finishing = result.current.finish(voice);
    });
    act(() => result.current.discard(voice));
    act(() => result.current.begin());
    act(() => result.current.transcript("Current", true, "two"));
    await act(async () => {
      pending.resolve();
      await finishing;
    });
    expect(useWorkspace.getState().drafts.sample).toBe("Existing");
    expect(result.current.active).toBe(true);
    await act(async () => result.current.finish(voice));
    expect(useWorkspace.getState().drafts.sample).toBe("Existing Current");
    expect(result.current.active).toBe(false);
    expect(voice.stop).toHaveBeenCalledOnce();
    act(() => useWorkspace.getState().draft("sample", "\n \n"));
    act(() => result.current.begin());
    act(() => result.current.transcript("First phrase", true, "three"));
    await act(async () => result.current.finish(voice));
    expect(useWorkspace.getState().drafts.sample).toBe("First phrase");
  } finally {
    cleanup();
    useWorkspace.setState(original, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
