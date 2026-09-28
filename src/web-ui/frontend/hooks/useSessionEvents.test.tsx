import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { SessionSnapshot } from "../../shared/protocol";

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
    rerender({ id: "next" });
    expect(connections[1]?.closed).toBe(true);
    expect(connections[2]?.url).toBe("/api/sessions/next/events");
    expect(connections[2]?.closed).toBe(false);
    unmount();
    expect(connections[2]?.closed).toBe(true);
    client.clear();
    cleanup();
    useSessions.setState({ views: {} });
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
