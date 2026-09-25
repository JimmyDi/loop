import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../shared/protocol";

test("lost prompt response preserves draft and retries the same identity", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { usePrompt } = await import("./usePrompt");
    const { useWorkspace } = await import("../state/workspace-store");
    const { useRequests } = await import("../state/request-store");
    const snapshot: SessionSnapshot = {
      streamId: "stream",
      sessionId: "s",
      workspaceId: "p",
      tools: {},
      model: { id: "test", provider: "test", name: "Test" },
      operation: "idle",
      state: {
        messages: [],
        isRunning: false,
        outcome: "idle",
        listenerErrors: [],
        hasPendingSave: false,
      },
    };
    const requests: string[] = [];

    useRequests.setState({ pending: {} });
    useWorkspace.getState().draft("s", "hello");
    globalThis.fetch = (async (_url, init) => {
      if (!init?.method) return Response.json(snapshot);

      requests.push(String(init.body));

      if (requests.length === 1) throw new Error("Network disconnected");

      return Response.json({ runId: "run" }, { status: 202 });
    }) as typeof fetch;

    const { result, rerender } = renderHook(({ value }) => usePrompt(value), {
      initialProps: { value: snapshot },
    });

    await act(() => result.current.submit());
    expect(result.current.uncertain).toBe(true);
    expect(result.current.text).toBe("hello");
    await act(() => result.current.submit(true));
    expect(requests[0]).toBe(requests[1]);
    const request = JSON.parse(requests[0]!);

    rerender({
      value: {
        ...snapshot,
        requestId: request.requestId,
        state: { ...snapshot.state, outcome: "success" },
      },
    });
    expect(result.current.text).toBe("");
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
