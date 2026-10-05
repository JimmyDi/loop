import { expect, test } from "vitest";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../shared/protocol";
import { useReadReceipt } from "./useReadReceipt";

test("completion is read only at the visible tail of a focused chat, including return from the background", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const calls: unknown[] = [];
  let fail = false;
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    if (fail) return Response.json({ code: "operation_failed" }, { status: 500 });
    return Response.json({ read: true });
  }) as typeof fetch;
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
      unread: true,
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  try {
    calls.length = 0;
    const hook = renderHook(
      ({ snapshot, connected }) => useReadReceipt(snapshot, connected, viewport, end),
      { initialProps: { snapshot, connected: true } },
    );
    markerTop = 450;
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(calls).toHaveLength(0);
    markerTop = 900;
    const settled = { ...snapshot, operation: "idle" as const };
    hook.rerender({ snapshot: settled, connected: true });
    expect(calls).toHaveLength(0);
    markerTop = 450;
    visible = false;
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(calls).toHaveLength(0);
    visible = true;
    focused = false;
    act(() => window.document.dispatchEvent(new window.Event("visibilitychange")));
    expect(calls).toHaveLength(0);
    focused = true;
    const dialog = window.document.createElement("dialog");
    dialog.setAttribute("open", "");
    window.document.body.append(dialog);
    act(() => window.dispatchEvent(new window.Event("focus")));
    expect(calls).toHaveLength(0);
    dialog.remove();
    expect(calls).toHaveLength(0);
    await act(async () => {
      window.document.dispatchEvent(new window.Event("focusin"));
    });
    expect(calls).toHaveLength(1);
    expect(calls).toEqual([{ workspaceId: "project", messageCount: 2 }]);
    await act(async () => {
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(calls).toHaveLength(1);

    hook.rerender({
      snapshot: { ...settled, state: { ...settled.state, unread: false } },
      connected: true,
    });
    await act(async () => {
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(calls).toHaveLength(1);

    const next = {
      ...settled,
      state: {
        ...settled.state,
        messages: [user, reply, user, reply],
      },
    };
    hook.rerender({ snapshot: next, connected: false });
    expect(calls).toHaveLength(1);
    markerTop = 900;
    hook.rerender({ snapshot: next, connected: true });
    expect(calls).toHaveLength(1);
    hook.rerender({
      snapshot: { ...next, state: { ...next.state, hasPendingSave: true } },
      connected: true,
    });
    markerTop = 480;
    await act(async () => {
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(calls).toHaveLength(1);
    markerTop = 900;
    hook.rerender({ snapshot: next, connected: true });
    markerTop = 480;
    await act(async () => {
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(calls).toHaveLength(2);
    hook.unmount();
    calls.length = 0;
    act(() => element.dispatchEvent(new window.Event("scroll")));
    expect(calls).toHaveLength(0);
    // An opened short completed answer is already fully visible.
    fail = true;
    await act(async () => {
      renderHook(() => useReadReceipt(settled, true, viewport, end));
    });
    expect(calls).toHaveLength(1);
    // Failed saves can retry while the answer is visible, without a read-position cache.
    fail = false;
    await act(async () => {
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(calls).toHaveLength(2);
    await act(async () => {
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(calls).toHaveLength(2);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
