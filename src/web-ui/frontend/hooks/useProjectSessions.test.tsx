import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("new sessions send only the selected project identity", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup, waitFor } = await import("@testing-library/react/pure");
    const { useProjectSessions } = await import("./useProjectSessions");
    const client = new QueryClient();
    let body: unknown;

    globalThis.fetch = (async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ sessionId: "s" });
    }) as typeof fetch;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProjectSessions("project", false), { wrapper });

    await act(() => result.current.create.mutateAsync());
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(body).toEqual({ workspaceId: "project" });
    cleanup();
    client.clear();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
