import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { useElapsedTime } from "./useElapsedTime";

test("elapsed time handles inactive state, updates and clears intervals on completion", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  let now = 6000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  let tick = () => {};
  const interval = vi.spyOn(window, "setInterval").mockImplementation(((callback: () => void) => {
    tick = callback;
    return 1;
  }) as unknown as typeof window.setInterval);
  const clear = vi.spyOn(window, "clearInterval");
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const hook = renderHook(
      ({ start, finish }: { start?: number; finish?: number }) => useElapsedTime(start, finish),
      { initialProps: {} },
    );
    expect(interval).not.toHaveBeenCalled();
    expect(hook.result.current.seconds).toBe(0);
    hook.rerender({ start: 1000 });
    expect(hook.result.current.duration).toBe("5s");
    act(() => {
      now = 66000;
      tick();
    });
    expect(hook.result.current.duration).toBe("1m 5s");
    hook.rerender({ start: 1000, finish: 7000 });
    expect(hook.result.current.duration).toBe("6s");
    expect(clear).toHaveBeenCalledWith(1);
    hook.rerender({ start: 10000, finish: 9000 });
    expect(hook.result.current.seconds).toBe(0);
  } finally {
    cleanup();
    vi.restoreAllMocks();
    clock.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
