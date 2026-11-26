import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useDocsSearch } from "./useDocsSearch";

const fixture = vi.hoisted(() => ({
  load: vi.fn(() => ({ default: { synthetic: { guide: "synthetic search text" } } })),
}));

vi.mock("virtual:docs-search", () => fixture.load());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("waits for page load and idle before fetching the search chunk", async () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  let idle: IdleRequestCallback | undefined;
  const schedule = vi.fn((callback: IdleRequestCallback) => {
    idle = callback;
    return 1;
  });
  vi.stubGlobal("requestIdleCallback", schedule);
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  const { result } = renderHook(() => useDocsSearch());
  expect(schedule).not.toHaveBeenCalled();
  expect(fixture.load).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("load")));
  expect(schedule).toHaveBeenCalledOnce();
  expect(fixture.load).not.toHaveBeenCalled();
  await act(async () => {
    idle?.({ didTimeout: false, timeRemaining: () => 10 });
  });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.index?.synthetic.guide).toBe("synthetic search text");
  expect(fixture.load).toHaveBeenCalledOnce();
});

it("loads on demand before the page load event and shares concurrent requests", async () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  const { result } = renderHook(() => useDocsSearch());
  await act(async () => {
    await Promise.all([result.current.load(), result.current.load()]);
  });
  expect(result.current.status).toBe("ready");
  expect(fixture.load).toHaveBeenCalledOnce();
});

it("cancels scheduled background work when leaving documentation", () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn(() => 7),
  );
  const cancel = vi.fn();
  vi.stubGlobal("cancelIdleCallback", cancel);
  const { unmount } = renderHook(() => useDocsSearch());
  unmount();
  expect(cancel).toHaveBeenCalledWith(7);
});

it("defers background loading with a timer when idle callbacks are unavailable", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  vi.stubGlobal("requestIdleCallback", undefined);
  const { result } = renderHook(() => useDocsSearch());
  await act(async () => vi.advanceTimersByTimeAsync(999));
  expect(result.current.status).toBe("idle");
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(result.current.status).toBe("ready");
});

it("reports a failed import and permits an explicit retry", async () => {
  vi.doMock("virtual:docs-search", () => {
    throw new Error("Synthetic network failure");
  });
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  const { result } = renderHook(() => useDocsSearch());
  await act(async () => result.current.load());
  expect(result.current.status).toBe("error");
  vi.doMock("virtual:docs-search", () => fixture.load());
  await act(async () => result.current.load());
  expect(result.current.status).toBe("ready");
});
