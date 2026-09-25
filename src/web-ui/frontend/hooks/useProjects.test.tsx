import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("project mutation posts a directory and invalidates the project list", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup, waitFor } = await import("@testing-library/react/pure");
    const { useProjects } = await import("./useProjects");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const bodies: unknown[] = [];

    globalThis.fetch = (async (_url, init) => {
      if (init?.method === "POST") {
        bodies.push(JSON.parse(String(init.body)));
        return Response.json({ id: "p", cwd: "/example", name: "Example" });
      }

      return Response.json([]);
    }) as typeof fetch;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useProjects, { wrapper });

    await act(() => result.current.add.mutateAsync("/example"));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    expect(bodies).toEqual([{ path: "/example" }]);
    cleanup();
    client.clear();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
