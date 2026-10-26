import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import type { VoiceControl } from "./voice-hook-types";
import type { PromptSubmission } from "./prompt-types";
import { useVoiceSubmission } from "./useVoiceSubmission";
import "../i18n/setup";

test("clearing a sending utterance prevents its response from deleting the next queued request", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const response = Promise.withResolvers<PromptSubmission>();
  const submitText = vi
    .fn()
    .mockImplementationOnce(() => response.promise)
    .mockResolvedValue("accepted");
  const notice = vi.fn();
  const voice = {
    mode: "conversation",
    status: "listening",
    muted: false,
    mute: vi.fn(),
  } as unknown as VoiceControl;
  const snapshot = {
    sessionId: "voice",
    operation: "idle",
    state: { isRunning: false, hasPendingSave: false },
  } as SessionSnapshot;
  try {
    const { result } = renderHook(() =>
      useVoiceSubmission({
        snapshot,
        connected: true,
        editing: false,
        voice,
        prompt: { pending: false, uncertain: false, submitText },
        notice,
      }),
    );
    await act(async () =>
      result.current.enqueue({ id: "old", text: "Old request", steering: false }),
    );
    expect(submitText).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.clear();
      result.current.enqueue({ id: "next", text: "Next request", steering: true });
    });
    await act(async () => {
      response.resolve("accepted");
      await response.promise;
    });
    expect(submitText.mock.calls.map((args) => args[0])).toEqual(["Old request", "Next request"]);
    expect(notice).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
