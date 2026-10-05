import { expect, test } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import type { Project, SessionSummary } from "../../../shared/protocol";
import { useWorkspace } from "../../state/workspace-store";
import "../../i18n/setup";
import { PinnedSessions } from "./PinnedSessions";

test("header pins load across collapsed projects, exclude unavailable history and follow list updates", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, waitFor, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const projects: Project[] = [
    { id: "p", name: "First project", cwd: "/example/first" },
    { id: "q", name: "Second project", cwd: "/example/second" },
    {
      id: "unavailable",
      name: "Unavailable project",
      cwd: "/example/unavailable",
      accessible: false,
    },
  ];
  const sessions: SessionSummary[] = Array.from({ length: 7 }, (_, index) => ({
    id: "s" + index,
    workspaceId: index % 2 ? "p" : "q",
    title: "Chat " + index,
    pinnedAt: new Date(1000 + index).toISOString(),
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messageCount: 2,
    userMessageCount: 1,
  }));
  const calls: string[] = [];
  globalThis.fetch = (async (url) => {
    const workspaceId = new URL(String(url), "http://localhost").searchParams.get("workspaceId");
    calls.push(workspaceId ?? "");
    return Response.json(sessions.filter((session) => session.workspaceId === workspaceId));
  }) as typeof fetch;
  try {
    useWorkspace.setState({
      expanded: { p: false, q: false },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <PinnedSessions projects={projects} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(ui.container.querySelectorAll(".session-item")).toHaveLength(7));
    expect(calls.sort()).toEqual(["p", "q"]);
    expect(
      Array.from(ui.container.querySelectorAll(".session-list-title"), (item) => item.textContent),
    ).toEqual([...sessions].reverse().map((session) => session.title ?? ""));
    expect(ui.queryByText("Show more")).toBeNull();
    // Archive/delete list changes remove rows; restoring archived history retains its pin.
    await act(async () => {
      client.setQueryData(["sessions", "p"], []);
      client.setQueryData(["sessions", "q"], []);
    });
    await waitFor(() => expect(ui.queryByRole("region", { name: "Pinned" })).toBeNull());
    await act(async () => {
      client.setQueryData(["sessions", "q"], [sessions[0]]);
    });
    await waitFor(() => expect(ui.getByTitle("Chat 0")).toBeTruthy());
    ui.rerender(
      <QueryClientProvider client={client}>
        <PinnedSessions projects={[]} />
      </QueryClientProvider>,
    );
    expect(ui.queryByRole("region", { name: "Pinned" })).toBeNull();
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    // Drain queued query notifications before removing the test browser globals.
    await new Promise((resolve) => setTimeout(resolve, 0));
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
