import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../shared/protocol";
import { useWorkspace } from "../state/workspace-store";
import { useRequests } from "../state/request-store";
import { useQueueEdits } from "../state/queue-edit-store";
import { useVoiceComposer } from "./useVoiceComposer";
import "../i18n/setup";

const voice = vi.hoisted(() => ({
  options: undefined as any,
  mode: undefined as string | undefined,
  status: "listening",
  start: vi.fn(),
  endInput: vi.fn(async () => {}),
  stop: vi.fn(),
  mute: vi.fn(),
  interrupt: vi.fn(),
  speak: vi.fn(),
  setupComplete: true,
}));
vi.mock("./useVoiceSetup", () => ({
  useVoiceSetup: () => ({ complete: false, ready: voice.setupComplete }),
}));
vi.mock("./useVoice", () => ({
  useVoice: (options: unknown) => {
    voice.options = options;
    return voice;
  },
}));

test("conversation dispatch preserves the typed draft, attachments and steering request identity", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const workspace = useWorkspace.getState();
  const requests = useRequests.getState();
  const edits = useQueueEdits.getState();
  const snapshot = {
    sessionId: "voice",
    streamId: "stream",
    operation: "prompt",
    tools: {},
    state: { messages: [], hasPendingSave: false },
  } as unknown as SessionSnapshot;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ runId: "run" }, { status: 202 });
  }) as typeof fetch;
  try {
    voice.mode = "conversation";
    useWorkspace.setState({
      drafts: { voice: "Typed draft" },
      files: { voice: [{ name: "draft.ts", text: "kept" }] },
    });
    useRequests.setState({ pending: {}, delivery: {} });
    useQueueEdits.setState({ edits: {} });
    const { result } = renderHook(() => useVoiceComposer(snapshot, true, true));
    expect(result.current.steering).toBe(true);
    await act(async () => {
      voice.options.transcript("Check the current direction", true, "utterance", "conversation");
    });
    expect(result.current.steering).toBe(false);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      text: "Check the current direction",
      streamId: "stream",
      steering: true,
    });
    expect(bodies[0]?.requestId).toEqual(expect.any(String));
    expect(bodies[0]?.files).toBeUndefined();
    expect(useWorkspace.getState().drafts.voice).toBe("Typed draft");
    expect(useWorkspace.getState().files.voice).toEqual([{ name: "draft.ts", text: "kept" }]);
    expect(result.current.notice).toContain("current tool batch");
    await act(async () => {
      voice.options.transcript("调整要求：仅检查类型", true, "prefix", "conversation");
    });
    expect(bodies[1]).toMatchObject({ text: "仅检查类型", steering: true });
    await act(async () => {
      voice.options.transcript("停止任务", false, "partial-control", "conversation");
    });
    expect(bodies).toHaveLength(2);
    act(() => {
      useQueueEdits.setState({
        edits: { voice: { id: "q", backup: { text: "", files: [], images: [], skills: [] } } },
      });
    });
    await act(async () => {
      voice.options.transcript("Do not send", true, "held", "conversation");
    });
    expect(bodies).toHaveLength(2);
  } finally {
    cleanup();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    useQueueEdits.setState(edits, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("dictation buffers speech until finish and discards cancelled samples", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const workspace = useWorkspace.getState();
  const snapshot = {
    sessionId: "voice",
    streamId: "stream",
    operation: "idle",
    tools: {},
    state: { messages: [], hasPendingSave: false },
  } as unknown as SessionSnapshot;
  try {
    voice.mode = "dictation";
    voice.stop.mockClear();
    useWorkspace.setState({ drafts: { voice: "Existing" } });
    const { result } = renderHook(() => useVoiceComposer(snapshot, true, true));
    act(() => result.current.start("dictation"));
    act(() => voice.options.transcript("hel", false, "one", "dictation"));
    expect(useWorkspace.getState().drafts.voice).toBe("Existing");
    act(() => voice.options.transcript("hello", true, "one", "dictation"));
    act(() => voice.options.transcript("world", false, "two", "dictation"));
    expect(useWorkspace.getState().drafts.voice).toBe("Existing");
    await act(async () => result.current.dictation?.finish(result.current.voice));
    expect(useWorkspace.getState().drafts.voice).toBe("Existing hello world");
    act(() => result.current.start("dictation"));
    act(() => voice.options.transcript("Discard me", true, "discard", "dictation"));
    act(() => window.dispatchEvent(new window.Event("loop-voice-edit")));
    expect(voice.stop).toHaveBeenCalledOnce();
    expect(result.current.notice).toContain("paused for editing");
    expect(useWorkspace.getState().drafts.voice).toBe("Existing hello world");
  } finally {
    cleanup();
    voice.mode = undefined;
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("incomplete setup prevents starting or resuming either voice mode", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const workspace = useWorkspace.getState();
  const snapshot = {
    sessionId: "voice",
    streamId: "stream",
    operation: "idle",
    tools: {},
    state: { messages: [], hasPendingSave: false },
  } as unknown as SessionSnapshot;
  try {
    voice.setupComplete = false;
    voice.mode = undefined;
    voice.start.mockClear();
    useWorkspace.setState({ drafts: { voice: "Preserved draft" } });
    const hook = renderHook(() => useVoiceComposer(snapshot, true, true));
    expect(hook.result.current.setupComplete).toBe(false);
    act(() => {
      hook.result.current.start("dictation");
      hook.result.current.start("conversation");
    });
    expect(voice.start).not.toHaveBeenCalled();
    voice.mode = "conversation";
    voice.status = "paused";
    hook.rerender();
    act(() => hook.result.current.start("conversation"));
    expect(voice.start).not.toHaveBeenCalled();
    voice.setupComplete = true;
    hook.rerender();
    expect(hook.result.current.setupComplete).toBe(true);
    act(() => hook.result.current.start("conversation"));
    expect(voice.start).toHaveBeenCalledExactlyOnceWith("conversation");
    expect(hook.result.current.steering).toBe(true);
    act(() => hook.result.current.setSteering(false));
    act(() => hook.result.current.start("conversation"));
    expect(hook.result.current.steering).toBe(true);
    expect(useWorkspace.getState().drafts.voice).toBe("Preserved draft");
  } finally {
    cleanup();
    voice.setupComplete = true;
    voice.mode = undefined;
    voice.status = "listening";
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
