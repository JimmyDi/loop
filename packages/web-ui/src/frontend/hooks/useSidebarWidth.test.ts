import { expect, test } from "vitest";

import { clampWidth } from "./useSidebarWidth";

test("sidebar width remains in the usable range even for corrupt preferences", () => {
  expect(clampWidth(150)).toBe(240);
  expect(clampWidth(1000)).toBe(420);
  expect(clampWidth(Number.NaN)).toBe(240);
  expect(clampWidth(320)).toBe(320);
});

test("dragging an inset border preserves the grab position and follows pointer movement", async () => {
  const { Window } = await import("happy-dom");
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const { useSidebarWidth } = await import("./useSidebarWidth");
  try {
    const { result } = renderHook(() => useSidebarWidth());
    act(() => result.current.setWidth(320));
    const event = {
      clientX: 368,
      button: 0,
      pointerId: 1,
      currentTarget: { hasPointerCapture: () => true, setPointerCapture: () => {} },
    } as unknown as import("react").PointerEvent<HTMLElement>;
    act(() => result.current.onPointerDown(event));
    act(() => result.current.onPointerMove(event));
    expect(result.current.width).toBe(320);
    act(() => result.current.onPointerMove({ ...event, clientX: 398 }));
    expect(result.current.width).toBe(350);
    act(() => result.current.onPointerMove({ ...event, clientX: 268 }));
    expect(result.current.width).toBe(240);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
