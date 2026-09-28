import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { useModelSelection } from "./useModelSelection";

test("selection waits for success, excludes duplicate changes and preserves cached state on failure", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const current = {
    sessionId: "test",
    model: { provider: "example", id: "one", name: "One" },
    effort: "low",
  } as SessionSnapshot;
  client.setQueryData(["session", "test"], current);
  let finish!: (response: Response) => void;
  let requests = 0;
  globalThis.fetch = (async (_url, init) => {
    requests++;
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body)).effort).toBe("high");
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  }) as typeof fetch;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    const { result } = renderHook(() => useModelSelection(current), { wrapper });
    const choice = { provider: "example", id: "one", effort: "high" as const };
    let operation!: Promise<boolean>;
    act(() => {
      operation = result.current.change(choice);
    });
    expect(result.current.pending).toBe(true);
    expect(await result.current.change(choice)).toBe(false);
    expect(requests).toBe(1);
    await act(async () => {
      finish(Response.json({ ...current, effort: "high" }));
      expect(await operation).toBe(true);
    });
    expect(client.getQueryData(["session", "test"])).toMatchObject({ effort: "high" });
    act(() => {
      operation = result.current.change(choice);
    });
    await act(async () => {
      finish(
        Response.json({ code: "invalid_model_effort", message: "Unsupported" }, { status: 400 }),
      );
      expect(await operation).toBe(false);
    });
    expect(result.current.error).toBeDefined();
    expect(client.getQueryData(["session", "test"])).toMatchObject({ effort: "high" });
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
