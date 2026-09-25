import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("async action blocks duplicate calls and releases after failure", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useAsyncAction } = await import("./useAsyncAction");
    const { result } = renderHook(useAsyncAction);
    let release!: () => void;
    let calls = 0;
    const task = new Promise<void>((resolve) => {
      release = resolve;
    });

    await act(async () => {
      const first = result.current.run(async () => {
        calls++;
        await task;
        throw new Error("failed");
      });

      await result.current.run(async () => {
        calls++;
      });
      release();
      await first;
    });
    expect(calls).toBe(1);
    expect(result.current.pending).toBe(false);
    expect(String(result.current.error)).toContain("failed");
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
