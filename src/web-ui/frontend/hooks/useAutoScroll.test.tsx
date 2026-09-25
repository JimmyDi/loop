import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("auto scroll respects user scroll position until explicitly resumed", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useAutoScroll } = await import("./useAutoScroll");
    const { result, rerender } = renderHook(({ revision }) => useAutoScroll(revision), {
      initialProps: { revision: 0 },
    });
    const element = window.document.createElement("div");

    Object.defineProperties(element, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 300 },
    });
    result.current.ref.current = element as unknown as HTMLDivElement;
    act(() => result.current.onScroll());
    rerender({ revision: 1 });
    expect(element.scrollTop).toBe(0);
    expect(result.current.atBottom).toBe(false);
    act(() => result.current.jump());
    expect(element.scrollTop).toBe(1000);
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
