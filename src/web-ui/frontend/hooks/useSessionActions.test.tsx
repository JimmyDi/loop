import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import type { ReactNode } from "react";

import type { SessionSummary } from "../../shared/protocol";
import { useSessionActions } from "./useSessionActions";
import { useWorkspace } from "../state/workspace-store";
import { useRequests } from "../state/request-store";

test("session actions preserve drafts on archive and failures; only successful deletion clears selected data", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  const requests = useRequests.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const session = {
    id: "s",
    workspaceId: "p",
    messageCount: 1,
    userMessageCount: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  let fail = true;
  const calls: string[] = [];
  globalThis.fetch = (async (url, init) => {
    calls.push(String(init?.method) + " " + url);
    return fail
      ? Response.json({ code: "project_busy" }, { status: 409 })
      : new Response(null, { status: 204 });
  }) as typeof fetch;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    useWorkspace.setState({
      active: { id: "s", workspaceId: "p" },
      drafts: { s: "Draft", other: "Keep" },
      files: { s: [{ name: "example.txt", text: "Text" }] },
    });
    useRequests.setState({
      pending: { s: { requestId: "request", streamId: "stream", text: "Draft" } },
    });
    const { result } = renderHook(() => useSessionActions(session), { wrapper });
    await act(async () => {
      expect(await result.current.change("delete")).toBe(false);
    });
    expect(useWorkspace.getState().active?.id).toBe("s");
    expect(useWorkspace.getState().drafts.s).toBe("Draft");
    expect(useRequests.getState().pending.s).toBeTruthy();
    fail = false;
    await act(async () => {
      expect(await result.current.change("archive")).toBe(true);
    });
    expect(useWorkspace.getState().active).toBeUndefined();
    expect(useWorkspace.getState().drafts.s).toBe("Draft");
    expect(useRequests.getState().pending.s).toBeTruthy();
    await act(async () => {
      expect(await result.current.change("delete")).toBe(true);
    });
    expect(useWorkspace.getState().drafts).toEqual({ other: "Keep" });
    expect(useWorkspace.getState().files.s).toBeUndefined();
    expect(useRequests.getState().pending.s).toBeUndefined();
    expect(calls).toEqual([
      "DELETE /api/workspaces/p/sessions/s",
      "POST /api/workspaces/p/archive",
      "DELETE /api/workspaces/p/sessions/s",
    ]);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("pin requests preserve rows on failure, prevent duplicate submissions and merge only acknowledged metadata", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const summary = {
    id: "s",
    workspaceId: "p",
    title: "Example",
    messageCount: 1,
    userMessageCount: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  const calls: unknown[] = [];
  let finish!: (response: Response) => void;
  globalThis.fetch = (async (url, init) => {
    calls.push({ url, method: init?.method, body: JSON.parse(String(init?.body)) });
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  }) as typeof fetch;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    client.setQueryData(["sessions", "p"], [summary]);
    useWorkspace.setState({ active: { id: "other", workspaceId: "p" }, drafts: { s: "Keep" } });
    const { result } = renderHook(() => useSessionActions(summary), { wrapper });
    let request!: Promise<void>;
    act(() => {
      request = result.current.setPinned(true);
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      await result.current.setPinned(true);
    });
    expect(calls).toHaveLength(1);
    expect(client.getQueryData<SessionSummary[]>(["sessions", "p"])).toEqual([summary]);
    await act(async () => {
      finish(Response.json({ code: "operation_failed" }, { status: 500 }));
      await request;
    });
    expect(result.current.error).toBeTruthy();
    expect(client.getQueryData<SessionSummary[]>(["sessions", "p"])).toEqual([summary]);
    act(() => {
      request = result.current.setPinned(true);
    });
    const pinnedAt = "2026-01-02T00:00:00.000Z";
    client.setQueryData(["sessions", "p"], [{ ...summary, title: "Updated", isGenerating: true }]);
    await act(async () => {
      finish(Response.json({ pinnedAt }));
      await request;
    });
    expect(result.current.error).toBeUndefined();
    expect(client.getQueryData<SessionSummary[]>(["sessions", "p"])).toEqual([
      { ...summary, title: "Updated", isGenerating: true, pinnedAt },
    ]);
    act(() => {
      request = result.current.setPinned(false);
    });
    await act(async () => {
      finish(Response.json({ pinnedAt: null }));
      await request;
    });
    expect(client.getQueryData<SessionSummary[]>(["sessions", "p"])).toEqual([
      { ...summary, title: "Updated", isGenerating: true, pinnedAt: undefined },
    ]);
    expect(calls).toEqual(
      [true, true, false].map((pinned) => ({
        url: "/api/sessions/s/pin",
        method: "PUT",
        body: { workspaceId: "p", pinned },
      })),
    );
    expect(useWorkspace.getState().active?.id).toBe("other");
    expect(useWorkspace.getState().drafts.s).toBe("Keep");
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
