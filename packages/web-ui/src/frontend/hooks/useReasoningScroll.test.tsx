import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { useReasoningScroll } from "./useReasoningScroll";

test("live reasoning follows the tail, respects scrolling up, and stops following history", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const { result, rerender } = renderHook(
      ({ revision, active }) => useReasoningScroll(revision, active),
      { initialProps: { revision: 0, active: true } },
    );
    const element = window.document.createElement("div");
    Object.defineProperties(element, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 300 },
    });
    result.current.ref.current = element as unknown as HTMLDivElement;
    rerender({ revision: 1, active: true });
    expect(element.scrollTop).toBe(1000);
    element.scrollTop = 100;
    act(() => result.current.onScroll());
    rerender({ revision: 2, active: true });
    expect(element.scrollTop).toBe(100);
    element.scrollTop = 700;
    act(() => result.current.onScroll());
    rerender({ revision: 3, active: true });
    expect(element.scrollTop).toBe(1000);
    element.scrollTop = 700;
    rerender({ revision: 4, active: false });
    expect(element.scrollTop).toBe(700);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
