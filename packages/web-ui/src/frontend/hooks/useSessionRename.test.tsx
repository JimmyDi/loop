import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { useSessions } from "../state/session-store";
import { useSessionRename } from "./useSessionRename";

test("rename acknowledgement only merges title fields into newer live state and retains SSE cursor", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const snapshot: SessionSnapshot = {
    sessionId: "rename-hook",
    workspaceId: "project",
    streamId: "stream",
    operation: "idle",
    tools: {},
    model: { id: "model", name: "Model", provider: "example" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  let finish!: (response: Response) => void;
  let calls = 0;
  globalThis.fetch = (async (_url, _init) => {
    calls++;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  }) as typeof fetch;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    const { result } = renderHook(() => useSessionRename(snapshot), { wrapper });
    let work!: Promise<boolean>;
    act(() => {
      work = result.current.rename("Saved title");
    });
    expect(await result.current.rename("Duplicate")).toBe(false);
    expect(calls).toBe(1);
    const live: SessionSnapshot = {
      ...snapshot,
      operation: "prompt",
      runId: "new-run",
      state: {
        ...snapshot.state,
        isRunning: true,
        messages: [{ role: "user", content: "New prompt", timestamp: 1 }],
      },
    };
    useSessions.setState({
      views: {
        [snapshot.sessionId]: {
          snapshot: live,
          connected: true,
          cursor: { streamId: "stream", seq: 20 },
        },
      },
    });
    client.setQueryData(["session", snapshot.sessionId], live);
    await act(async () => {
      finish(
        Response.json({
          ...snapshot,
          state: {
            ...snapshot.state,
            title: { text: "Saved title", source: "user", messageIndices: [] },
          },
        }),
      );
      expect(await work).toBe(true);
    });
    const view = useSessions.getState().views[snapshot.sessionId]!;
    expect(view.cursor?.seq).toBe(20);
    expect(view.snapshot?.operation).toBe("prompt");
    expect(view.snapshot?.state.messages).toEqual(live.state.messages);
    expect(view.snapshot?.state.title?.text).toBe("Saved title");
    expect(client.getQueryData(["session", snapshot.sessionId])).toMatchObject({
      operation: "prompt",
      runId: "new-run",
    });
  } finally {
    cleanup();
    client.clear();
    useSessions.setState({ views: {} });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
