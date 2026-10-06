import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("creation cannot submit until the picker finishes and removal preserves the custom name", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const { useCreateProject } = await import("./useCreateProject");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["projects"], []);
  const onCreated = vi.fn();
  let finishPick!: (response: Response) => void;
  globalThis.fetch = vi.fn(
    async () =>
      new Promise<Response>((resolve) => {
        finishPick = resolve;
      }),
  ) as typeof fetch;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  try {
    const { result } = renderHook(() => useCreateProject(onCreated), { wrapper });
    await act(() => result.current.create());
    expect(globalThis.fetch).not.toHaveBeenCalled();
    act(() => result.current.changeName("Custom"));
    let choosing!: Promise<void>;
    act(() => {
      choosing = result.current.pickFolder();
    });
    expect(result.current.picking).toBe(true);
    await act(() => result.current.create());
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    await act(async () => {
      finishPick(Response.json({ path: "/example/folder" }));
      await choosing;
    });
    expect(result.current.canCreate).toBe(true);
    act(() => result.current.removeFolder());
    expect(result.current.path).toBe("");
    expect(result.current.name).toBe("Custom");
    expect(result.current.canCreate).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
