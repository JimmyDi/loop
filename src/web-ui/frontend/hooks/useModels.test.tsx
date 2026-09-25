import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("model choices use the shared cached catalog", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, cleanup } = await import("@testing-library/react/pure");
    const { useModels } = await import("./useModels");
    const client = new QueryClient();
    const catalog = [{ provider: "example", id: "model", name: "Model" }];

    client.setQueryData(["models"], catalog);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useModels, { wrapper });

    expect(result.current.data).toEqual(catalog);
    cleanup();
    client.clear();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
