import { expect, test, vi } from "vitest";

import { onExpiry } from "./expiry";

test("persistent login expiry does not overflow Node timers and can be cancelled", () => {
  vi.useFakeTimers();
  try {
    const expire = vi.fn();
    const cancel = onExpiry(Date.now() + 30 * 24 * 60 * 60 * 1000, expire);
    vi.advanceTimersByTime(2_147_483_647);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000 - 2_147_483_647);
    expect(expire).toHaveBeenCalledOnce();
    cancel();
    const stopped = vi.fn();
    const stop = onExpiry(Date.now() + 100, stopped);
    stop();
    vi.advanceTimersByTime(100);
    expect(stopped).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
