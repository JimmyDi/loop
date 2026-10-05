import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("settings save invalidates the model catalog without caching the API key", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup, waitFor } = await import("@testing-library/react/pure");
    const { useProviderSettings } = await import("./useProviderSettings");
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const input = {
      name: "Gateway",
      baseUrl: "http://localhost:8080/v1",
      id: "gateway",
      kind: "custom" as const,
      api: "openai-completions",
      models: [{ id: "gpt-5.5" }],
      authentication: "apiKey" as const,
      apiKey: "test-secret",
    };

    client.setQueryData(["provider-settings"], { providers: [], catalog: [] });
    client.setQueryData(["models"], []);
    globalThis.fetch = (async (_url, init) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toEqual(input);
      const { apiKey: _key, ...publicFields } = input;

      return Response.json({ providers: [{ ...publicFields, hasApiKey: true }], catalog: [] });
    }) as typeof fetch;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useProviderSettings, { wrapper });

    await act(() => result.current.save(input, true));
    await waitFor(() => expect(result.current.query.data?.providers[0]?.hasApiKey).toBe(true));
    expect(JSON.stringify(client.getQueryData(["provider-settings"]))).not.toContain("test-secret");
    expect(client.getQueryState(["models"])?.isInvalidated).toBe(true);
    cleanup();
    client.clear();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
