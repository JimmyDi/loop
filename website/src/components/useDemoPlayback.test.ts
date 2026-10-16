import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { providerDemoFrames } from "./provider-demo";
import { integrationDemoFrames } from "./integration-demo";
import { workflowDemoFrames } from "./workflow-demo";
import { useDemoPlayback } from "./useDemoPlayback";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  { name: "provider", frames: providerDemoFrames },
  { name: "integrations", frames: integrationDemoFrames },
  { name: "workflow", frames: workflowDemoFrames },
])("cycles $name scenes, pauses offscreen and on user request, and clears timers", ({ frames }) => {
  vi.useFakeTimers();
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const { result, unmount } = renderHook(() => useDemoPlayback(frames));
  act(() => vi.advanceTimersByTime(8000));
  expect(result.current.frame).toBe(0);
  act(() => intersect([{ isIntersecting: true }]));
  act(() => vi.advanceTimersByTime(frames[0].duration));
  expect(result.current.frame).toBe(1);
  act(() => intersect([{ isIntersecting: false }]));
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current.frame).toBe(1);
  act(() => intersect([{ isIntersecting: true }]));
  act(() => vi.advanceTimersByTime(frames[1].duration));
  expect(result.current.frame).toBe(2);
  act(() => result.current.toggle());
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current.frame).toBe(2);
  expect(result.current.playing).toBe(false);
  act(() => result.current.toggle());
  for (const item of [...frames.slice(2), ...frames.slice(0, 2)]) {
    act(() => vi.advanceTimersByTime(item.duration));
  }
  expect(result.current.frame).toBe(2);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(disconnect).toHaveBeenCalled();
});

it("keeps reduced-motion scenes static and suspends hidden-page playback", () => {
  vi.useFakeTimers();
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  let intersect: (entries: { isIntersecting: boolean }[]) => void = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const { result } = renderHook(() => useDemoPlayback(providerDemoFrames));
  act(() => intersect([{ isIntersecting: true }]));
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current.frame).toBe(0);
  expect(result.current.reduced).toBe(true);
  media.matches = false;
  act(() => media.addEventListener.mock.calls[0]![1]());
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  act(() => vi.advanceTimersByTime(10000));
  expect(result.current.frame).toBe(0);
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  act(() => vi.advanceTimersByTime(4000));
  expect(result.current.frame).toBe(1);
});
