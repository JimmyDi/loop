import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../shared/protocol";
import { useReadState } from "../state/read-store";
import { useReadReceipt } from "./useReadReceipt";

test("completion is read only at the visible tail of a focused chat, including return from the background", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const original = useReadState.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const element = window.document.createElement("div");
  const marker = window.document.createElement("div");
  element.append(marker);
  window.document.body.append(element);
  Object.defineProperty(element, "clientHeight", { value: 500 });
  let markerTop = 900;
  let visible = true;
  let focused = true;
  Object.defineProperty(window.document, "visibilityState", {
    get: () => (visible ? "visible" : "hidden"),
  });
  window.document.hasFocus = () => focused;
  marker.getBoundingClientRect = () => new window.DOMRect(0, markerTop, 100, 0);
  const viewport = { current: element as unknown as HTMLDivElement };
  const end = { current: marker as unknown as HTMLDivElement };
  const user = { role: "user" as const, content: "Example", timestamp: 0 };
  const reply = {
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "Example reply" }],
    api: "openai-completions" as const,
    provider: "example",
    model: "example",
    timestamp: 1,
    stopReason: "stop" as const,
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
    sessionId: "example",
    workspaceId: "project",
    streamId: "stream",
    operation: "prompt",
    model: { id: "example", name: "Example", provider: "example" },
    tools: {},
    state: {
      messages: [user, reply],
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      runTimings: [{ userMessageIndex: 0, startedAt: 0, finishedAt: 10 }],
    },
  };
  try {
    useReadState.setState({ readTurns: {} });
    const hook = renderHook(
      ({ snapshot, connected }) => useReadReceipt(snapshot, connected, viewport, end),
      { initialProps: { snapshot, connected: true } },
    );
    markerTop = 450;
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(useReadState.getState().readTurns.example).toBeUndefined();
    markerTop = 900;
    const settled = { ...snapshot, operation: "idle" as const };
    hook.rerender({ snapshot: settled, connected: true });
    expect(useReadState.getState().readTurns.example).toBeUndefined();
    markerTop = 450;
    visible = false;
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(useReadState.getState().readTurns.example).toBeUndefined();
    visible = true;
    focused = false;
    act(() => window.document.dispatchEvent(new window.Event("visibilitychange")));
    expect(useReadState.getState().readTurns.example).toBeUndefined();
    focused = true;
    const dialog = window.document.createElement("dialog");
    dialog.setAttribute("open", "");
    window.document.body.append(dialog);
    act(() => window.dispatchEvent(new window.Event("focus")));
    expect(useReadState.getState().readTurns.example).toBeUndefined();
    dialog.remove();
    act(() => window.document.dispatchEvent(new window.Event("focusin")));
    expect(useReadState.getState().readTurns.example).toBe(0);

    const next = {
      ...settled,
      state: {
        ...settled.state,
        messages: [user, reply, user, reply],
        runTimings: [
          ...settled.state.runTimings!,
          { userMessageIndex: 2, startedAt: 20, finishedAt: 30 },
        ],
      },
    };
    hook.rerender({ snapshot: next, connected: false });
    expect(useReadState.getState().readTurns.example).toBe(0);
    markerTop = 900;
    hook.rerender({ snapshot: next, connected: true });
    expect(useReadState.getState().readTurns.example).toBe(0);
    markerTop = 480;
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(useReadState.getState().readTurns.example).toBe(2);
    hook.unmount();
    useReadState.setState({ readTurns: {} });
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(useReadState.getState().readTurns.example).toBeUndefined();
    // An opened short completed answer is already fully visible.
    renderHook(() => useReadReceipt(settled, true, viewport, end));
    expect(useReadState.getState().readTurns.example).toBe(0);
  } finally {
    cleanup();
    useReadState.setState(original, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
