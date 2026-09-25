import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("native picker cancellation does not select a project", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useDirectoryPicker } = await import("./useDirectoryPicker");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let selected = "";

    globalThis.fetch = (async (url) =>
      Response.json(
        String(url).endsWith("/pick") ? { path: null } : { native: true, preferred: "native" },
      )) as typeof fetch;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useDirectoryPicker((path) => {
          selected = path;
        }),
      { wrapper },
    );

    await act(() => result.current.pick());
    expect(selected).toBe("");
    expect(result.current.picking).toBe(false);
    expect(result.current.error).toBeUndefined();
    cleanup();
    client.clear();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
