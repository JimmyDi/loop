import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import type { SessionSnapshot, SessionSummary } from "../../../shared/protocol";
import { useSessions } from "../../state/session-store";
import { useWorkspace } from "../../state/workspace-store";
import "../../i18n/setup";
import { SessionList } from "./SessionList";

test("SessionList exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionList
        sessions={[
          {
            id: "s",
            workspaceId: "p",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            messageCount: 0,
            userMessageCount: 0,
          },
        ]}
      />
    </QueryClientProvider>,
  );

  expect(html).toContain("<button");
  expect(html).toContain("New session");
  expect(html).not.toContain("2026");
  client.clear();
});

test("SessionList displays persisted summary titles instead of dates", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionList
        sessions={[
          {
            id: "titled",
            workspaceId: "p",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            messageCount: 2,
            userMessageCount: 1,
            title: "Fix language settings",
          },
        ]}
      />
    </QueryClientProvider>,
  );
  expect(html).toContain("Fix language settings");
  client.clear();
  expect(html).not.toContain("2026");
});

test("generation rings follow live prompt events and background summaries without blocking selection", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const sessionsState = useSessions.getState();
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, act, fireEvent, cleanup, within } = await import("@testing-library/react/pure");
  const snapshot: SessionSnapshot = {
    sessionId: "first",
    workspaceId: "project",
    streamId: "stream",
    operation: "idle",
    model: { id: "example", provider: "example", name: "Example" },
    tools: {},
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const summaries: SessionSummary[] = [
    {
      id: "first",
      title: "First conversation",
      workspaceId: "project",
      messageCount: 0,
      userMessageCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "second",
      title: "Background conversation",
      workspaceId: "project",
      messageCount: 0,
      userMessageCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      isGenerating: true,
    },
  ];
  try {
    useWorkspace.getState().open({ id: "first", workspaceId: "project" });
    useSessions.setState({ views: {} });
    useSessions.getState().frame({
      type: "session.snapshot",
      sessionId: "first",
      streamId: "stream",
      seq: 0,
      snapshot,
    });
    const client = new QueryClient();
    const wrapper = ({ children }: { children: import("react").ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const ui = render(<SessionList sessions={summaries} />, { wrapper });
    const first = ui.getByTitle("First conversation");
    const second = ui.getByTitle("Background conversation");
    expect(within(first).queryByRole("img")).toBeNull();
    expect(within(second).getByRole("img", { name: "Looping..." })).toBeTruthy();
    act(() => {
      useSessions.getState().frame({
        type: "run.accepted",
        sessionId: "first",
        streamId: "stream",
        seq: 1,
        requestId: "request",
        runId: "run",
      });
    });
    expect(within(first).getByRole("img", { name: "Looping..." })).toBeTruthy();
    expect(first.querySelector(".session-list-title")?.textContent).toBe("First conversation");
    expect(first.lastElementChild?.className).toBe("session-list-spinner");
    fireEvent.click(second);
    expect(useWorkspace.getState().active?.id).toBe("second");
    expect(second.getAttribute("aria-current")).toBe("page");

    // A stale polling response must not override an already-settled live snapshot.
    ui.rerender(
      <SessionList sessions={summaries.map((session) => ({ ...session, isGenerating: true }))} />,
    );
    let seq = 2;
    for (const outcome of ["success", "cancelled", "error"] as const) {
      act(() => {
        useSessions.getState().frame({
          type: "session.state",
          sessionId: "first",
          streamId: "stream",
          seq: seq++,
          snapshot: { ...snapshot, state: { ...snapshot.state, outcome } },
        });
      });
      expect(within(first).queryByRole("img")).toBeNull();
    }
    for (const operation of ["model", "flush", "title"] as const) {
      act(() => {
        useSessions.getState().frame({
          type: "session.state",
          sessionId: "first",
          streamId: "stream",
          seq: seq++,
          snapshot: { ...snapshot, operation },
        });
      });
      expect(within(first).queryByRole("img")).toBeNull();
    }
    ui.rerender(
      <SessionList sessions={summaries.map((session) => ({ ...session, isGenerating: false }))} />,
    );
    expect(ui.queryByRole("img")).toBeNull();
    client.clear();
  } finally {
    cleanup();
    useSessions.setState(sessionsState, true);
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
