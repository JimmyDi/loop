import { expect, test, vi } from "vitest";

import { voiceCommand } from "./request";

test("voice HTTP deadlines and caller cancellation abort pending requests", async () => {
  vi.useFakeTimers();
  const previous = globalThis.fetch;
  const signals: AbortSignal[] = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    const signal = init?.signal as AbortSignal;
    signals.push(signal);
    return new Promise<Response>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  try {
    const deadline = voiceCommand("/voice/calls", {}, { timeout: 40_000 }).catch(
      (error: Error) => error.message,
    );
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await deadline).toBe("voice_connection_timeout");
    expect(signals[0]?.aborted).toBe(true);
    const controller = new AbortController();
    const cancelled = voiceCommand("/voice/calls", {}, { signal: controller.signal }).catch(
      () => "cancelled",
    );
    controller.abort();
    expect(await cancelled).toBe("cancelled");
    expect(signals[1]?.aborted).toBe(true);
  } finally {
    globalThis.fetch = previous;
    vi.useRealTimers();
  }
});
