import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { useNavigationRail } from "./useNavigationRail";

test("rail follows active turns, tracks overflow and anchors previews to scrolled marks", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const element = window.document.createElement("div");
  let height = 120;
  let reduced = false;
  const media = vi
    .spyOn(window, "matchMedia")
    .mockImplementation(() => ({ matches: reduced }) as ReturnType<typeof window.matchMedia>);
  for (let index = 0; index < 100; index++) {
    const mark = window.document.createElement("button");
    Object.defineProperties(mark, {
      offsetTop: { get: () => 4 + index * 12 },
      offsetHeight: { get: () => 12 },
    });
    element.append(mark);
  }
  Object.defineProperties(element, {
    clientHeight: { get: () => height },
    scrollHeight: { get: () => 1208 },
  });
  const scroll = vi.spyOn(element, "scrollTo").mockImplementation((options) => {
    element.scrollTop = (options as ScrollToOptions).top ?? 0;
  });
  try {
    const ui = renderHook(
      ({ active, hover, count }) => useNavigationRail(active, hover, count, "session"),
      {
        initialProps: { active: 99, hover: -1, count: 0 },
      },
    );
    ui.result.current.marks.current = element as unknown as HTMLDivElement;
    ui.rerender({ active: 99, hover: -1, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 1088, behavior: "instant" });
    expect(ui.result.current).toMatchObject({ above: true, below: false });
    ui.rerender({ active: 50, hover: 50, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 600, behavior: "smooth" });
    expect(ui.result.current).toMatchObject({ above: true, below: true, previewTop: 24 });
    ui.rerender({ active: 49, hover: 49, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 588, behavior: "smooth" });
    expect(ui.result.current.previewTop).toBe(24);
    scroll.mockClear();
    ui.rerender({ active: 50, hover: 50, count: 100 });
    expect(scroll).not.toHaveBeenCalled();
    expect(ui.result.current.previewTop).toBe(24);
    ui.rerender({ active: 57, hover: 57, count: 100 });
    expect(scroll).not.toHaveBeenCalled();
    expect(694 - element.scrollTop).toBe(106);
    ui.rerender({ active: 58, hover: 58, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 596, behavior: "smooth" });
    expect(706 - element.scrollTop).toBe(110);
    expect(ui.result.current.previewTop).toBe(96);
    ui.rerender({ active: 59, hover: 59, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 608, behavior: "smooth" });
    expect(ui.result.current.previewTop).toBe(96);
    ui.rerender({ active: 60, hover: 60, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 620, behavior: "smooth" });
    expect(ui.result.current.previewTop).toBe(96);
    act(() => {
      element.scrollTop += 96;
      ui.result.current.onScroll();
    });
    expect(ui.result.current.previewTop).toBe(24);
    act(() => {
      element.scrollTop += 120;
      ui.result.current.onScroll();
    });
    expect(ui.result.current.previewTop).toBeUndefined();
    height = 720;
    act(() => window.dispatchEvent(new window.Event("resize")));
    ui.rerender({ active: 40, hover: 40, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 480, behavior: "smooth" });
    expect(490 - element.scrollTop).toBe(10);
    ui.rerender({ active: 41, hover: 41, count: 100 });
    expect(element.scrollTop).toBe(480);
    height = 12;
    act(() => window.dispatchEvent(new window.Event("resize")));
    expect(scroll).toHaveBeenLastCalledWith({ top: 496, behavior: "smooth" });
    height = 120;
    reduced = true;
    ui.rerender({ active: 0, hover: 0, count: 100 });
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
    expect(ui.result.current).toMatchObject({ above: false, below: true });
    height = 240;
    act(() => window.dispatchEvent(new window.Event("resize")));
    expect(ui.result.current.previewTop).toBe(48);
  } finally {
    cleanup();
    media.mockRestore();
    scroll.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
