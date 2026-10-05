import { expect, test } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import type { ReactNode } from "react";

import { useArchivedChats } from "./useArchivedChats";
import type { ArchivedChat } from "./useArchivedChats";
import { useWorkspace } from "../state/workspace-store";
import { useRequests } from "../state/request-store";

test("bulk deletion retains failed-project chats and unsent data while refreshing completed projects", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  const requests = useRequests.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  let records = ["a", "b"].map((id) => ({
    id,
    workspaceId: id,
    projectName: id,
    messageCount: 1,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  })) as ArchivedChat[];
  client.setQueryData(["archived-chats"], records);
  globalThis.fetch = (async (url, init) => {
    if (init?.method === "DELETE") {
      if (String(url).includes("/b/"))
        return Response.json({ code: "project_busy" }, { status: 409 });
      records = records.filter((session) => session.id !== "a");
      return new Response(null, { status: 204 });
    }
    if (String(url).endsWith("/workspaces"))
      return Response.json([
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ]);
    const id = new URL(String(url), "http://localhost").searchParams.get("workspaceId");
    return Response.json(records.filter((session) => session.id === id));
  }) as typeof fetch;
  try {
    useWorkspace.setState({
      active: { id: "b", workspaceId: "b" },
      drafts: { a: "A", b: "B" },
      files: { a: [{ name: "a.txt", text: "A" }], b: [{ name: "b.txt", text: "B" }] },
      draftProjects: { a: "a", b: "b" },
    });
    useRequests.setState({
      pending: {
        a: { requestId: "a", streamId: "a", text: "A" },
        b: { requestId: "b", streamId: "b", text: "B" },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useArchivedChats(), { wrapper });
    await act(async () => {
      await result.current.change
        .mutateAsync({ selected: [...records], action: "delete" })
        .catch(() => {});
    });
    await waitFor(() => expect(result.current.change.isError).toBe(true));
    expect(result.current.sessions.data?.map((session) => session.id)).toEqual(["b"]);
    expect(useWorkspace.getState().drafts).toEqual({ b: "B" });
    expect(Object.keys(useWorkspace.getState().files)).toEqual(["b"]);
    expect(Object.keys(useRequests.getState().pending)).toEqual(["b"]);
    expect(useWorkspace.getState().active?.id).toBe("b");
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
