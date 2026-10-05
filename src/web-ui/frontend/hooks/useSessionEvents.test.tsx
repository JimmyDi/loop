import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { Frame, Message, SessionEvent, SessionSnapshot } from "../../shared/protocol";
import type { SessionSummary } from "../../shared/protocol";
import { MessageTimeline } from "../components/chat/MessageTimeline";
import { SessionList } from "../components/projects/SessionList";
import { useProjectSessions } from "./useProjectSessions";
import { useListEvents } from "./useListEvents";
import { useSessionEvents } from "./useSessionEvents";
import { useSessions } from "../state/session-store";
import { useWorkspace } from "../state/workspace-store";
import "../i18n/setup";

test.each([false, true])(
  "switching sessions preserves live status until settlement (waiting: %s)",
  async (waiting) => {
    const indicator = waiting ? "Waiting for approval" : "Looping...";
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      EventSource: globalThis.EventSource,
      fetch: globalThis.fetch,
    };
    const sessionsState = useSessions.getState();
    const workspace = useWorkspace.getState();
    const connections: LocalSource[] = [];
    class LocalSource {
      onmessage?: (event: { data: string }) => void;
      closed = false;
      constructor(readonly url: string) {
        connections.push(this);
      }
      close() {
        this.closed = true;
      }
    }
    Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
    const { render, act, fireEvent, waitFor, cleanup, within } = await import(
      "@testing-library/react/pure"
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const summaries: SessionSummary[] = ["first", "second"].map((id) => ({
      id,
      title: id,
      workspaceId: "project",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      messageCount: 1,
      userMessageCount: 1,
      isGenerating: false,
    }));
    const pending: { signal?: AbortSignal | null; resolve: (value: Response) => void }[] = [];
    globalThis.fetch = ((_url, init) =>
      new Promise<Response>((resolve) =>
        pending.push({ signal: init?.signal, resolve }),
      )) as typeof fetch;
    const Page = () => {
      const active = useWorkspace((state) => state.active);
      const { sessions } = useProjectSessions("project", true);
      useListEvents();
      useSessionEvents(active?.id);
      return <SessionList sessions={sessions.data ?? []} />;
    };
    try {
      useSessions.setState({ views: {} });
      useWorkspace.getState().open({ id: "first", workspaceId: "project" });
      client.setQueryData(["sessions", "project"], summaries);
      const ui = render(
        <QueryClientProvider client={client}>
          <Page />
        </QueryClientProvider>,
      );
      expect(pending).toHaveLength(1);
      const source = connections.find(
        (item) => item.url === "/api/sessions/first/events?approvals=1",
      )!;
      const lists = connections.find((item) => item.url === "/api/workspaces/events")!;
      act(() => {
        source.onmessage?.({
          data: JSON.stringify({
            type: "session.snapshot",
            sessionId: "first",
            streamId: "stream",
            seq: 0,
            snapshot: {
              sessionId: "first",
              streamId: "stream",
              workspaceId: "project",
              model: { id: "example", provider: "example", name: "Example" },
              operation: "idle",
              tools: {},
              state: {
                messages: [],
                unread: true,
                isRunning: false,
                hasPendingSave: false,
                outcome: "idle",
                listenerErrors: [],
                pendingApprovals: waiting
                  ? [
                      {
                        requestId: "approval",
                        sessionId: "first",
                        toolName: "write",
                        toolCallId: "call",
                        reason: "Create the requested file",
                        policy: "ask",
                        createdAt: 0,
                        expiresAt: null,
                      },
                    ]
                  : [],
              },
            } satisfies SessionSnapshot,
          } satisfies Frame),
        });
        source.onmessage?.({
          data: JSON.stringify({
            type: "run.accepted",
            sessionId: "first",
            streamId: "stream",
            seq: 1,
            requestId: "request",
            runId: "run",
          } satisfies Frame),
        });
      });
      const first = ui.getByTitle("first");
      expect(within(first).getByRole("img", { name: indicator })).toBeTruthy();
      fireEvent.click(ui.getByTitle("second"));
      expect(source.closed).toBe(true);
      expect(
        client.getQueryData<SessionSummary[]>(["sessions", "project"])?.[0]?.isWaitingForApproval,
      ).toBe(waiting);
      expect(useSessions.getState().views.first?.connected).toBe(false);
      expect(client.getQueryData<SessionSummary[]>(["sessions", "project"])?.[0]?.unread).toBe(
        true,
      );
      act(() => source.onmessage?.({ data: "late frame from a closed subscription" }));
      expect(
        connections.filter((item) => item.url === "/api/sessions/first/events?approvals=1"),
      ).toHaveLength(1);
      expect(within(first).getByRole("img", { name: indicator })).toBeTruthy();
      expect(
        (ui.getByRole("button", { name: "Archive first" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(pending[0]!.signal?.aborted).toBe(true);
      await waitFor(() => expect(pending).toHaveLength(2));
      await act(async () => {
        pending[0]!.resolve(Response.json(summaries));
        await Bun.sleep(10);
      });
      expect(within(first).getByRole("img", { name: indicator })).toBeTruthy();
      await act(async () => {
        pending[1]!.resolve(
          Response.json(
            summaries.map((item) => ({
              ...item,
              isGenerating: item.id === "first",
              isWaitingForApproval: waiting && item.id === "first",
            })),
          ),
        );
        await Bun.sleep(10);
      });
      expect(within(first).getByRole("img", { name: indicator })).toBeTruthy();
      act(() =>
        lists.onmessage?.({
          data: JSON.stringify({
            type: "sessions.changed",
            workspaceId: "project",
            streamId: "lists",
            seq: 1,
          }),
        }),
      );
      await waitFor(() => expect(pending).toHaveLength(3));
      await act(async () => {
        pending[2]!.resolve(Response.json(summaries));
        await Bun.sleep(10);
      });
      expect(within(first).queryByRole("img", { name: indicator })).toBeNull();
      expect(useSessions.getState().views.first?.snapshot?.operation).toBe("prompt");
      expect(useWorkspace.getState().active?.id).toBe("second");
    } finally {
      cleanup();
      client.clear();
      useSessions.setState(sessionsState, true);
      useWorkspace.setState(workspace, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("SSE hook requests a fresh snapshot on a gap and closes only its connection", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
  };
  const connections: LocalSource[] = [];
  class LocalSource {
    onmessage?: (event: { data: string }) => void;
    onerror?: () => void;
    closed = false;
    constructor(readonly url: string) {
      connections.push(this);
    }
    close() {
      this.closed = true;
    }
  }

  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useSessionEvents } = await import("./useSessionEvents");
    const { useSessions } = await import("../state/session-store");
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const snapshot: SessionSnapshot = {
      sessionId: "s",
      streamId: "stream",
      workspaceId: "p",
      model: { id: "example", provider: "example", name: "Example" },
      operation: "idle",
      tools: {},
      state: {
        messages: [],
        isRunning: false,
        hasPendingSave: false,
        outcome: "idle",
        listenerErrors: [],
        title: { text: "Live title", source: "model", messageIndices: [0] },
      },
    };
    client.setQueryData(["sessions", "p"], []);

    useSessions.setState({ views: {} });
    const { unmount, rerender } = renderHook(({ id }) => useSessionEvents(id), {
      wrapper,
      initialProps: { id: "s" },
    });

    act(() =>
      connections[0]?.onmessage?.({
        data: JSON.stringify({
          type: "session.snapshot",
          sessionId: "s",
          streamId: "stream",
          seq: 0,
          snapshot,
        }),
      }),
    );
    client.setQueryData(["sessions", "p"], []);
    act(() =>
      connections[0]?.onmessage?.({
        data: JSON.stringify({
          type: "loop.event",
          sessionId: "s",
          streamId: "stream",
          seq: 1,
          runId: "run",
          messageIndex: 0,
          event: {
            type: "message_end",
            message: { role: "user", content: "First prompt", timestamp: 1 },
          },
        }),
      }),
    );
    expect(client.getQueryState(["sessions", "p"])?.isInvalidated).toBe(false);
    act(() =>
      connections[0]?.onmessage?.({
        data: JSON.stringify({
          type: "run.accepted",
          sessionId: "s",
          streamId: "stream",
          seq: 3,
          runId: "run",
          requestId: "r",
        }),
      }),
    );
    expect(connections[0]?.closed).toBe(true);
    expect(useSessions.getState().views.s?.snapshot?.state.title?.text).toBe("Live title");
    expect(client.getQueryState(["sessions", "p"])?.isInvalidated).toBe(false);
    expect(connections[1]?.url).not.toContain("cursor");
    expect(useSessions.getState().views.s?.connected).toBe(false);
    act(() => useSessions.getState().resync("s"));
    expect(connections[1]?.closed).toBe(true);
    expect(connections[2]?.url).toBe("/api/sessions/s/events?approvals=1");
    expect(connections[2]?.url).not.toContain("cursor");
    rerender({ id: "next" });
    expect(connections[2]?.closed).toBe(true);
    expect(connections[3]?.url).toBe("/api/sessions/next/events?approvals=1");
    expect(connections[3]?.closed).toBe(false);
    act(() => useSessions.getState().resync("s"));
    expect(connections).toHaveLength(4);
    unmount();
    expect(connections[3]?.closed).toBe(true);
    client.clear();
    cleanup();
    useSessions.setState({ views: {} });
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("an SSE burst preserves each tool's running indication while results and errors arrive immediately", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
  };
  let source: LocalSource;
  class LocalSource {
    onmessage?: (event: { data: string }) => void;
    constructor() {
      source = this;
    }
    send(frame: Frame) {
      this.onmessage?.({ data: JSON.stringify(frame) });
    }
    close() {}
  }
  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
  const { render, act, cleanup, waitFor } = await import("@testing-library/react/pure");
  const { useSessionEvents } = await import("./useSessionEvents");
  const { useSessions } = await import("../state/session-store");
  const calls = ["first", "second", "failed"].map((id) => ({
    type: "toolCall" as const,
    id,
    name: "read",
    arguments: { path: `${id}.md` },
  }));
  const assistant: Extract<Message, { role: "assistant" }> = {
    role: "assistant",
    content: calls,
    api: "openai-completions",
    provider: "example",
    model: "example",
    stopReason: "toolUse",
    timestamp: 0,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
  const snapshot: SessionSnapshot = {
    sessionId: "s",
    streamId: "stream",
    workspaceId: "p",
    model: { id: "example", provider: "example", name: "Example" },
    operation: "prompt",
    tools: {},
    state: {
      messages: [{ role: "user", content: "Read the files", timestamp: 0 }, assistant],
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const View = () => {
    useSessionEvents("s");
    const view = useSessions((state) => state.views.s);
    return view?.snapshot ? (
      <MessageTimeline snapshot={view.snapshot} connected={view.connected} />
    ) : null;
  };
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  let seq = 0;
  const sendEvent = (event: SessionEvent) =>
    source.send({
      type: "loop.event",
      sessionId: "s",
      streamId: "stream",
      seq: ++seq,
      runId: "run",
      event,
    });
  try {
    useSessions.setState({ views: {} });
    const ui = render(<View />, { wrapper });
    act(() =>
      source.send({ type: "session.snapshot", sessionId: "s", streamId: "stream", seq, snapshot }),
    );
    const cards = ui.container.querySelectorAll<HTMLDetailsElement>(".tool-card");
    expect(cards).toHaveLength(3);
    cards[0]!.open = true;

    // Start/end events share one browser task: React must not skip every running state.
    act(() => {
      for (const call of calls) {
        sendEvent({
          type: "tool_execution_start",
          toolCallId: call.id,
          toolName: call.name,
          args: call.arguments,
        });
        sendEvent({
          type: "tool_execution_end",
          toolCallId: call.id,
          toolName: call.name,
          isError: call.id === "failed",
          result: {
            role: "toolResult",
            toolCallId: call.id,
            toolName: call.name,
            content: [{ type: "text", text: `Output ${call.id}` }],
            isError: call.id === "failed",
            timestamp: 0,
          },
        });
      }
    });
    const icon = (index: number) => cards[index]!.querySelector(".activity-status-icon");
    for (const index of [0, 1]) {
      expect(cards[index]!.dataset.status).toBe("success");
      expect(icon(index)?.getAttribute("data-status")).toBe("running");
      expect(icon(index)?.getAttribute("aria-label")).toBe("Completed");
      expect(cards[index]!.textContent).toContain(`Output ${calls[index]!.id}`);
    }
    expect(icon(2)?.getAttribute("data-status")).toBe("error");
    expect(cards[0]!.open).toBe(true);
    expect(ui.container.querySelector(".tool-card")).toBe(cards[0]!);
    await waitFor(() => {
      expect(icon(0)?.getAttribute("data-status")).toBe("success");
      expect(icon(1)?.getAttribute("data-status")).toBe("success");
    });

    const restored = useSessions.getState().views.s!.snapshot!;
    ui.unmount();
    const history = render(<View />, { wrapper });
    act(() =>
      source.send({
        type: "session.snapshot",
        sessionId: "s",
        streamId: "stream",
        seq,
        snapshot: restored,
      }),
    );
    expect(
      history.container.querySelector('.tool-card .activity-status-icon[data-status="running"]'),
    ).toBeNull();
    expect(history.container.querySelectorAll('.tool-card[data-status="success"]')).toHaveLength(2);
  } finally {
    cleanup();
    client.clear();
    useSessions.setState({ views: {} });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
