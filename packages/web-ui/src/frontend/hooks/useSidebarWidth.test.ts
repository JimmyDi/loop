import { expect, test } from "vitest";

import { clampWidth } from "./useSidebarWidth";

test("sidebar width remains in the usable range even for corrupt preferences", () => {
  expect(clampWidth(150)).toBe(260);
  expect(clampWidth(1000)).toBe(420);
  expect(clampWidth(Number.NaN)).toBe(260);
  expect(clampWidth(320)).toBe(320);
});

test("dragging subtracts the navigation offset from the sidebar width", async () => {
  const { Window } = await import("happy-dom");
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const { useSidebarWidth } = await import("./useSidebarWidth");
  try {
    const { result } = renderHook(() => useSidebarWidth());
    const event = {
      clientX: 372,
      pointerId: 1,
      currentTarget: { hasPointerCapture: () => true },
    } as unknown as import("react").PointerEvent<HTMLElement>;
    act(() => result.current.onPointerMove(event, 52));
    expect(result.current.width).toBe(320);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
