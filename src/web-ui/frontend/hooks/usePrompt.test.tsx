import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../shared/protocol";

test("large attachments are submitted intact and API failures preserve drafts for retry", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const { usePrompt } = await import("./usePrompt");
  const { useWorkspace } = await import("../state/workspace-store");
  const { useRequests } = await import("../state/request-store");
  const workspace = useWorkspace.getState();
  const pending = useRequests.getState();
  const files = [{ name: "large.ts", text: "x".repeat(1024 * 1024) }];
  const images = [{ type: "image" as const, data: "AAAA", mimeType: "image/png" }];
  const snapshot: SessionSnapshot = {
    streamId: "stream",
    sessionId: "context",
    workspaceId: "project",
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
  try {
    useWorkspace.setState({
      drafts: { context: "Review" },
      files: { context: files },
      images: { context: images },
    });
    useRequests.setState({ pending: {} });
    const bodies: { requestId: string; files: typeof files }[] = [];
    globalThis.fetch = (async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return bodies.length === 1
        ? Response.json({ code: "session_busy", message: "Session is busy" }, { status: 409 })
        : Response.json({ runId: "run" }, { status: 202 });
    }) as typeof fetch;
    const { result } = renderHook(() => usePrompt(snapshot));
    await act(() => result.current.submit());
    expect(bodies[0]?.files).toEqual(files);
    expect(result.current.error).toMatchObject({ code: "session_busy" });
    expect(result.current.text).toBe("Review");
    expect(result.current.files).toEqual(files);
    expect(result.current.images).toEqual(images);
    expect(result.current.uncertain).toBe(false);
    expect(useRequests.getState().pending.context).toBeUndefined();
    await act(() => result.current.submit());
    expect(result.current.error).toBeUndefined();
    expect(bodies[1]?.files).toEqual(files);
    expect(bodies[1]?.requestId).not.toBe(bodies[0]?.requestId);
  } finally {
    cleanup();
    useWorkspace.setState(workspace, true);
    useRequests.setState(pending, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

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
    const images = [{ type: "image" as const, mimeType: "image/png", data: "AAAA" }];
    useWorkspace.getState().attach("s", images);
    const files = [{ name: "example.ts", text: "const x = 1;" }];
    useWorkspace.getState().attachFiles("s", files);
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
    expect(result.current.images).toEqual(images);
    expect(result.current.files).toEqual(files);
    act(() => useWorkspace.getState().attachFiles("s", []));
    expect(result.current.files).toEqual(files);
    await act(() => result.current.submit(true));
    expect(requests[0]).toBe(requests[1]);
    const request = JSON.parse(requests[0]!);
    expect(request.images).toEqual(images);
    expect(request.files).toEqual(files);

    rerender({
      value: {
        ...snapshot,
        requestId: request.requestId,
        state: { ...snapshot.state, outcome: "success" },
      },
    });
    expect(result.current.text).toBe("");
    expect(result.current.images).toEqual([]);
    expect(result.current.files).toEqual([]);
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["success", "error", "cancelled"] as const)(
  "file-only prompts support completion and failure recovery: %s",
  async (outcome) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { usePrompt } = await import("./usePrompt");
    const { useWorkspace } = await import("../state/workspace-store");
    const { useRequests } = await import("../state/request-store");
    const { promptContent } = await import("../../shared/prompt-images");
    const workspace = useWorkspace.getState();
    const pending = useRequests.getState();
    const files = [{ name: "example.txt", text: "Example" }];
    const snapshot: SessionSnapshot = {
      streamId: "stream",
      sessionId: "file-only",
      workspaceId: "project",
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
    try {
      useWorkspace.setState({ images: {}, files: { "file-only": files }, drafts: {} });
      useRequests.setState({ pending: {} });
      let body: { requestId: string; text: string; files: typeof files } | undefined;
      globalThis.fetch = (async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return Response.json({}, { status: 202 });
      }) as typeof fetch;
      const { result, rerender } = renderHook(({ value }) => usePrompt(value), {
        initialProps: { value: snapshot },
      });
      await act(() => result.current.submit());
      expect(body?.text).toBe("");
      expect(body?.files).toEqual(files);
      const accepted = {
        ...snapshot,
        requestId: body!.requestId,
        operation: "prompt" as const,
        state: {
          ...snapshot.state,
          messages: [
            { role: "user" as const, content: promptContent("", [], files), timestamp: 0 },
          ],
        },
      };
      rerender({ value: accepted });
      expect(result.current.files).toEqual([]);
      act(() => useWorkspace.getState().attachFiles("file-only", []));
      rerender({
        value: { ...accepted, operation: "idle", state: { ...accepted.state, outcome } },
      });
      expect(result.current.files).toEqual(outcome === "success" ? [] : files);
      expect(useRequests.getState().pending["file-only"]).toBeUndefined();
    } finally {
      cleanup();
      useWorkspace.setState(workspace, true);
      useRequests.setState(pending, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
