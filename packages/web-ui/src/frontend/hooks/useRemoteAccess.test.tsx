import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

test("failed status checks wait for manual retry instead of interval, focus or reconnect", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  vi.resetModules();
  vi.useFakeTimers();
  const requests: string[] = [];
  let failing = true;
  globalThis.fetch = vi.fn(async (url) => {
    requests.push(String(url));
    return failing
      ? Response.json({ code: "remote_status_failed" }, { status: 503 })
      : Response.json({ supported: true, installed: true, signedIn: false, phase: "off" });
  }) as typeof fetch;
  const { QueryClient, QueryClientProvider, focusManager, onlineManager } = await import(
    "@tanstack/react-query"
  );
  const { useRemoteAccess } = await import("./useRemoteAccess");
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  try {
    const wrapper = ({ children }: { children: import("react").ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useRemoteAccess, { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.query.isError).toBe(true);
    expect(requests).toEqual(["/api/remote-access?refresh=1"]);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(requests).toHaveLength(1);
    failing = false;
    await act(async () => {
      await result.current.query.refetch();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.query.isSuccess).toBe(true);
    expect(requests).toEqual(["/api/remote-access?refresh=1", "/api/remote-access?refresh=1"]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(requests[2]).toBe("/api/remote-access");
    expect(requests.filter((url) => url.includes("refresh=1"))).toHaveLength(2);
  } finally {
    cleanup();
    client.clear();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
