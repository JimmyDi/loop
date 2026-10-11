import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { readDraft, useQueueEdits, writeDraft } from "../state/queue-edit-store";
import { useWorkspace } from "../state/workspace-store";
import { useQueuedComposer } from "./useQueuedComposer";

test("server hold loads a complete draft; failed saves retain it and successful saves restore backup", async () => {
  const { Window } = await import("happy-dom");
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  const edits = useQueueEdits.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const skillId = "a".repeat(24);
  client.setQueryData(["skills", "p"], { skills: [{ id: skillId, name: "Review" }] });
  const image = { type: "image" as const, mimeType: "image/png", data: "AAAA" };
  const { promptContent } = await import("../../shared/prompt-images");
  const item = {
    id: "held",
    content: promptContent(
      "Full text\nSecond line",
      [image],
      [{ name: "code.ts", text: "const value = 1;" }],
    ),
    skills: [skillId],
    steering: false,
    editing: true,
  };
  const confirmed = Promise.withResolvers<Response>();
  const bodies: Record<string, unknown>[] = [];
  let failSave = true;
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    if (body.action === "begin-edit")
      return bodies.length === 1 ? confirmed.promise : Response.json({ item });
    if (body.action === "edit" && failSave)
      return Response.json({ code: "queue_conflict", message: "Failed" }, { status: 409 });
    return Response.json({ accepted: true });
  }) as typeof fetch;
  const snapshot: SessionSnapshot = {
    streamId: "s",
    sessionId: "s",
    workspaceId: "p",
    operation: "idle",
    tools: {},
    model: { id: "test", name: "Test", provider: "test" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      queue: [item],
    },
  };
  let focused = 0;
  try {
    useQueueEdits.setState({ edits: {} });
    const backup = { text: "Original draft", images: [], files: [], skills: [] };
    writeDraft("s", backup);
    const ui = renderHook(() => useQueuedComposer(snapshot, () => focused++), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    let beginning!: Promise<void>;
    act(() => {
      beginning = ui.result.current.begin("held");
    });
    expect(readDraft("s")).toEqual(backup);
    expect(ui.result.current.editing).toBeUndefined();
    await act(async () => {
      confirmed.resolve(Response.json({ item }));
      await beginning;
    });
    expect(readDraft("s")).toEqual({
      text: "Full text\nSecond line",
      images: [image],
      files: [{ name: "code.ts", text: "const value = 1;" }],
      skills: [{ id: skillId, name: "Review" }],
    });
    writeDraft("s", { text: "Revised", images: [], files: [], skills: [] });
    await act(async () => ui.result.current.save());
    expect(ui.result.current.editing?.id).toBe("held");
    expect(readDraft("s").text).toBe("Revised");
    expect(bodies.at(-1)).toEqual({
      id: "held",
      action: "edit",
      text: "Revised",
      images: [],
      files: [],
      skills: [],
    });
    failSave = false;
    await act(async () => ui.result.current.save());
    expect(ui.result.current.editing).toBeUndefined();
    expect(readDraft("s")).toEqual(backup);
    expect(focused).toBe(2);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useQueueEdits.setState(edits, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
