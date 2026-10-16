import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useHeaderScroll } from "./useHeaderScroll";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("handles restored scroll, batches updates, reverses and releases listeners and frames", () => {
  const header = document.createElement("header");
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.set(++id, callback);
    return id;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  vi.stubGlobal("scrollY", 400);
  const { unmount } = renderHook(() => useHeaderScroll({ current: header }));
  expect(header.style.getPropertyValue("--header-progress")).toBe("1");
  expect(header.dataset.floating).toBe("true");
  vi.stubGlobal("scrollY", 60);
  act(() => {
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
  });
  expect(callbacks.size).toBe(1);
  act(() => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(0);
  });
  expect(header.style.getPropertyValue("--header-progress")).toBe("0.5");
  vi.stubGlobal("scrollY", -10);
  act(() => window.dispatchEvent(new Event("pageshow")));
  act(() => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(0);
  });
  expect(header.style.getPropertyValue("--header-progress")).toBe("0");
  expect(header.dataset.floating).toBe("false");
  act(() => window.dispatchEvent(new Event("scroll")));
  unmount();
  expect(cancel).toHaveBeenCalledWith(id);
  expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  window.dispatchEvent(new Event("scroll"));
  expect(callbacks.size).toBe(0);
});

it("uses a static floating state for reduced motion and reacts to preference changes", () => {
  const header = document.createElement("header");
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  let update: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    update = callback;
    return 1;
  });
  vi.stubGlobal("scrollY", 24);
  renderHook(() => useHeaderScroll({ current: header }));
  expect(header.style.getPropertyValue("--header-progress")).toBe("1");
  media.matches = false;
  act(() => media.addEventListener.mock.calls[0][1]());
  act(() => update?.(0));
  expect(header.style.getPropertyValue("--header-progress")).toBe("0.2");
});
