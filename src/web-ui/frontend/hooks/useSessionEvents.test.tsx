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
    const snapshot = { sessionId: "s", streamId: "stream" } as SessionSnapshot;

    useSessions.setState({ views: {} });
    const { unmount } = renderHook(() => useSessionEvents("s"), { wrapper });

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
    act(() =>
      connections[0]?.onmessage?.({
        data: JSON.stringify({
          type: "run.accepted",
          sessionId: "s",
          streamId: "stream",
          seq: 2,
          runId: "run",
          requestId: "r",
        }),
      }),
    );
    expect(connections[0]?.closed).toBe(true);
    expect(connections[1]?.url).not.toContain("cursor");
    expect(useSessions.getState().views.s?.connected).toBe(false);
    unmount();
    expect(connections[1]?.closed).toBe(true);
    client.clear();
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
