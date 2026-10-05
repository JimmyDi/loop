import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import type { SessionSnapshot, SessionSummary } from "../../../shared/protocol";
import { useSessions } from "../../state/session-store";
import { useWorkspace } from "../../state/workspace-store";
import "../../i18n/setup";
import { SessionList } from "./SessionList";

const createSummaries = (count: number): SessionSummary[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `session-${index + 1}`,
    workspaceId: "example-project",
    title: `Conversation ${index + 1}`,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messageCount: 2,
    userMessageCount: 1,
  }));

test.each([0, 1, 5, 6])("SessionList initially shows at most five of %i sessions", (count) => {
  const client = new QueryClient();
  try {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <SessionList sessions={createSummaries(count)} />
      </QueryClientProvider>,
    );
    expect(html.match(/class="session-item"/g) ?? []).toHaveLength(Math.min(count, 5));
    expect(html.includes("Show more")).toBe(count > 5);
    expect(html.includes("No chats")).toBe(count === 0);
  } finally {
    client.clear();
  }
});

test.each([6, 15, 16, 25, 26])(
  "SessionList reveals ten more per click until all %i sessions are visible",
  async (count) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient();
    const sessions = createSummaries(count);
    const wrapper = ({ children }: { children: import("react").ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    try {
      const ui = render(<SessionList sessions={sessions} />, { wrapper });
      for (let visible = 5; visible < count; visible += 10) {
        expect(ui.container.querySelectorAll(".session-item")).toHaveLength(visible);
        fireEvent.click(ui.getByRole("button", { name: "Show more" }));
        const expected = Math.min(visible + 10, count);
        expect(
          Array.from(
            ui.container.querySelectorAll(".session-list-title"),
            (item) => item.textContent,
          ),
        ).toEqual(sessions.slice(0, expected).map((session) => session.title ?? ""));
        // Background refreshes must preserve the number of revealed entries.
        ui.rerender(<SessionList sessions={sessions.map((session) => ({ ...session }))} />);
        expect(ui.container.querySelectorAll(".session-item")).toHaveLength(expected);
      }
      expect(ui.queryByRole("button", { name: "Show more" })).toBeNull();
      ui.rerender(<SessionList sessions={sessions.slice(0, 5)} />);
      expect(ui.container.querySelectorAll(".session-item")).toHaveLength(5);
      expect(ui.queryByRole("button", { name: "Show more" })).toBeNull();
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

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
    const request = {
      requestId: "approval",
      sessionId: "first",
      toolName: "write",
      toolCallId: "call",
      reason: "Create the requested file",
      policy: "ask" as const,
      createdAt: 0,
      expiresAt: null,
    };
    let seq = 2;
    for (const operation of ["prompt", "idle"] as const) {
      act(() => {
        useSessions.getState().frame({
          type: "session.state",
          sessionId: "first",
          streamId: "stream",
          seq: seq++,
          snapshot: {
            ...snapshot,
            operation,
            state: { ...snapshot.state, pendingApprovals: [request] },
          },
        });
      });
      expect(within(first).getByRole("img", { name: "Waiting for approval" })).toBeTruthy();
      expect(first.firstElementChild?.className).toBe("session-list-waiting");
      expect(first.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
      expect(first.lastElementChild?.className).toBe("session-list-pending");
      expect(within(first).getAllByRole("img")).toHaveLength(1);
      expect(within(first).queryByRole("img", { name: "Looping..." })).toBeNull();
      expect(
        (ui.getByRole("button", { name: "Archive First conversation" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    }
    fireEvent.click(second);
    expect(useWorkspace.getState().active?.id).toBe("second");
    expect(second.getAttribute("aria-current")).toBe("page");

    // A stale polling response must not override an already-settled live snapshot.
    ui.rerender(
      <SessionList
        sessions={summaries.map((session) => ({
          ...session,
          isGenerating: true,
          isWaitingForApproval: true,
        }))}
      />,
    );
    expect(within(second).getByRole("img", { name: "Waiting for approval" })).toBeTruthy();
    expect(second.lastElementChild?.className).toBe("session-list-pending");
    expect(within(second).queryByRole("img", { name: "Looping..." })).toBeNull();
    act(() => {
      useSessions.getState().frame({
        type: "session.state",
        sessionId: "first",
        streamId: "stream",
        seq: seq++,
        snapshot: { ...snapshot, operation: "prompt" },
      });
    });
    expect(within(first).queryByRole("img", { name: "Waiting for approval" })).toBeNull();
    expect(first.querySelector(".session-list-pending")).toBeNull();
    expect(within(first).getByRole("img", { name: "Looping..." })).toBeTruthy();
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

test("completed unread turns show a blue-dot indicator until the actual reading receipt arrives", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const originalSessions = useSessions.getState();
  const originalWorkspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const summary: SessionSummary = {
    id: "unread-session",
    workspaceId: "project",
    title: "Example",
    messageCount: 2,
    userMessageCount: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  const wrapper = ({ children }: { children: import("react").ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    useSessions.setState({ views: {} });
    const ui = render(<SessionList sessions={[{ ...summary, isGenerating: true }]} />, { wrapper });
    expect(ui.getByRole("img", { name: "Looping..." })).toBeTruthy();
    expect(ui.queryByRole("img", { name: "Unread" })).toBeNull();
    const complete = { ...summary, isGenerating: false, unread: true };
    ui.rerender(<SessionList sessions={[{ ...complete, isWaitingForApproval: true }]} />);
    expect(ui.getByRole("img", { name: "Waiting for approval" })).toBeTruthy();
    expect(ui.queryByRole("img", { name: "Unread" })).toBeNull();
    expect(
      (ui.getByRole("button", { name: "Archive Example" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    ui.rerender(<SessionList sessions={[complete]} />);
    expect(ui.queryByRole("img", { name: "Looping..." })).toBeNull();
    expect(ui.getByRole("img", { name: "Unread" }).className).toBe("session-list-unread");
    const button = ui.getByTitle("Example");
    expect(button.lastElementChild?.className).toBe("session-list-unread");
    fireEvent.click(button);
    expect(useWorkspace.getState().active?.id).toBe(summary.id);
    expect(ui.getByRole("img", { name: "Unread" })).toBeTruthy();
    ui.unmount();
    const reopened = render(<SessionList sessions={[complete]} />, { wrapper });
    expect(reopened.getByRole("img", { name: "Unread" })).toBeTruthy();
    // Another browser's durable receipt arrives through a refreshed list.
    reopened.rerender(<SessionList sessions={[{ ...complete, unread: false }]} />);
    expect(reopened.queryByRole("img", { name: "Unread" })).toBeNull();
    // Title updates cannot create unread content; a later completed turn can.
    reopened.rerender(
      <SessionList sessions={[{ ...complete, title: "Renamed", unread: false }]} />,
    );
    expect(reopened.queryByRole("img", { name: "Unread" })).toBeNull();
    reopened.rerender(<SessionList sessions={[{ ...complete, messageCount: 4 }]} />);
    expect(reopened.getByRole("img", { name: "Unread" })).toBeTruthy();
    reopened.rerender(
      <SessionList sessions={[{ ...complete, messageCount: 4, isGenerating: true }]} />,
    );
    expect(reopened.queryByRole("img", { name: "Unread" })).toBeNull();
    expect(reopened.getByRole("img", { name: "Looping..." })).toBeTruthy();
    reopened.rerender(<SessionList sessions={[summary]} />);
    expect(reopened.queryByRole("img")).toBeNull();
  } finally {
    cleanup();
    client.clear();
    useSessions.setState(originalSessions, true);
    useWorkspace.setState(originalWorkspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
