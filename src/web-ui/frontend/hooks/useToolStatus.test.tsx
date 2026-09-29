import { expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";

import type { ToolView } from "../../shared/protocol";
import { useToolStatus } from "./useToolStatus";

test("fast success keeps a running icon briefly without replaying history or delaying failures", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  let now = 0;
  const clock = spyOn(performance, "now").mockImplementation(() => now);
  const timers = new Map<number, { callback: () => void; at: number }>();
  let nextTimer = 0;
  window.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++nextTimer, { callback, at: now + delay });
    return nextTimer;
  }) as unknown as typeof window.setTimeout;
  window.clearTimeout = ((id: number) => {
    timers.delete(id);
  }) as unknown as typeof window.clearTimeout;
  const tick = (time: number) => {
    now = time;
    act(() => {
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    });
  };
  const props = (id: string, status: ToolView["status"]) => ({ id, status });
  try {
    const ui = renderHook(({ id, status }) => useToolStatus(id, status), {
      initialProps: props("first", "waiting"),
    });
    expect(ui.result.current).toBe("waiting");
    ui.rerender(props("first", "running"));
    tick(3);
    ui.rerender(props("first", "success"));
    expect(ui.result.current).toBe("running");
    tick(100);
    ui.rerender(props("first", "success"));
    expect(timers.size).toBe(1);
    expect(ui.result.current).toBe("running");
    tick(200);
    expect(ui.result.current).toBe("success");
    expect(timers.size).toBe(0);

    ui.rerender(props("historical", "success"));
    expect(ui.result.current).toBe("success");
    expect(timers.size).toBe(0);
    ui.rerender(props("slow", "running"));
    tick(500);
    ui.rerender(props("slow", "success"));
    expect(ui.result.current).toBe("success");
    expect(timers.size).toBe(0);

    ui.rerender(props("failed", "running"));
    ui.rerender(props("failed", "error"));
    expect(ui.result.current).toBe("error");
    expect(timers.size).toBe(0);
    ui.rerender(props("cancelled", "running"));
    ui.rerender(props("cancelled", "success"));
    expect(timers.size).toBe(1);
    ui.rerender(props("cancelled", "error"));
    expect(ui.result.current).toBe("error");
    expect(timers.size).toBe(0);

    ui.rerender(props("switch", "running"));
    ui.rerender(props("switch", "success"));
    ui.rerender(props("other", "waiting"));
    expect(ui.result.current).toBe("waiting");
    expect(timers.size).toBe(0);
    ui.rerender(props("other", "running"));
    ui.rerender(props("other", "success"));
    ui.unmount();
    expect(timers.size).toBe(0);

    const restored = renderHook(() => useToolStatus("historical", "success"));
    expect(restored.result.current).toBe("success");
  } finally {
    cleanup();
    clock.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("reduced motion and hidden pages do not hold completed icons", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  let reduced = true;
  let hidden = false;
  window.matchMedia = (() => ({ matches: reduced })) as unknown as typeof window.matchMedia;
  Object.defineProperty(window.document, "hidden", { get: () => hidden });
  const props = (status: ToolView["status"]) => ({ status });
  try {
    const ui = renderHook(({ status }) => useToolStatus("call", status), {
      initialProps: props("running"),
    });
    ui.rerender(props("success"));
    expect(ui.result.current).toBe("success");
    reduced = false;
    hidden = true;
    ui.rerender(props("running"));
    ui.rerender(props("success"));
    expect(ui.result.current).toBe("success");
    hidden = false;
    ui.rerender(props("running"));
    ui.rerender(props("success"));
    expect(ui.result.current).toBe("running");
    hidden = true;
    act(() => document.dispatchEvent(new window.Event("visibilitychange") as unknown as Event));
    expect(ui.result.current).toBe("success");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
