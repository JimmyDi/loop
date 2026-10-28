import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { useVoiceSampleCountdown } from "./useVoiceSampleCountdown";

test("chat dictation counts down sixty seconds only after listening starts", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  vi.useFakeTimers();
  const finish = vi.fn(async () => {});
  try {
    const { result, rerender } = renderHook(
      ({ listening }) => useVoiceSampleCountdown(true, listening, finish, 60),
      { initialProps: { listening: false } },
    );
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current).toBeUndefined();
    expect(finish).not.toHaveBeenCalled();
    rerender({ listening: true });
    expect(result.current).toBe(60);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current).toBe(30);
    expect(finish).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current).toBe(0);
    expect(finish).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
