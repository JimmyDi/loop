import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { useWorkspace } from "../state/workspace-store";
import { useContextCompaction } from "./useContextCompaction";

test("compaction guards idle state, duplicate calls and pending saves, preserving newer drafts", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  const snapshot = {
    sessionId: "test",
    model: { provider: "test", id: "model", name: "Test" },
    operation: "idle",
    state: {
      messages: [1, 2].map((timestamp) => ({ role: "user", content: "Task", timestamp })),
      hasPendingSave: false,
    },
  } as SessionSnapshot;
  const pending = Promise.withResolvers<Response>();
  globalThis.fetch = vi.fn(() => pending.promise);
  try {
    useWorkspace.setState({ drafts: { test: "/compact" } });
    const hook = renderHook(({ current, connected }) => useContextCompaction(current, connected), {
      initialProps: { current: snapshot, connected: true },
    });
    let work: Promise<boolean>;
    act(() => {
      work = hook.result.current.start();
      void hook.result.current.start();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    act(() => useWorkspace.getState().draft("test", "Newer draft"));
    await act(async () => {
      pending.resolve(Response.json({}));
      expect(await work).toBe(true);
    });
    expect(useWorkspace.getState().drafts.test).toBe("Newer draft");
    for (const current of [
      { ...snapshot, operation: "prompt" as const },
      { ...snapshot, state: { ...snapshot.state, hasPendingSave: true } },
      {
        ...snapshot,
        state: {
          ...snapshot.state,
          compaction: {
            id: "example",
            firstKeptMessageIndex: 1,
            historyMessageCount: 2,
            timestamp: 1,
          },
        },
      },
    ]) {
      hook.rerender({ current, connected: true });
      expect(hook.result.current.disabled).toBe(true);
      expect(await hook.result.current.start()).toBe(false);
    }
    hook.rerender({ current: snapshot, connected: false });
    expect(await hook.result.current.start()).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    hook.rerender({ current: snapshot, connected: true });
    act(() => useWorkspace.getState().draft("test", "/compact"));
    globalThis.fetch = vi.fn(async () =>
      Response.json(
        {
          code: "nothing_to_compact",
          message: "Nothing to compact",
        },
        { status: 400 },
      ),
    );
    await act(async () => {
      expect(await hook.result.current.start()).toBe(false);
    });
    expect(hook.result.current.error).toMatchObject({ code: "nothing_to_compact" });
    expect(useWorkspace.getState().drafts.test).toBe("/compact");
    expect(hook.result.current.disabled).toBe(true);
    expect(await hook.result.current.start()).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    hook.rerender({ current: { ...snapshot, operation: "compact" }, connected: true });
    expect(hook.result.current.error).toMatchObject({ code: "nothing_to_compact" });
    hook.rerender({ current: snapshot, connected: true });
    expect(hook.result.current.error).toMatchObject({ code: "nothing_to_compact" });
    hook.rerender({ current: { ...snapshot, operation: "prompt" }, connected: true });
    expect(hook.result.current.error).toBeUndefined();
    hook.rerender({
      current: {
        ...snapshot,
        state: {
          ...snapshot.state,
          messages: [
            ...snapshot.state.messages,
            { role: "user", content: "New task", timestamp: 3 },
          ],
        },
      },
      connected: true,
    });
    expect(hook.result.current.disabled).toBe(false);
    hook.rerender({
      current: {
        ...snapshot,
        model: { provider: "test", id: "larger", name: "Larger" },
        state: { ...snapshot.state, compactionAvailable: false },
      },
      connected: true,
    });
    expect(hook.result.current.disabled).toBe(true);
    expect(await hook.result.current.start()).toBe(false);
    hook.rerender({
      current: {
        ...snapshot,
        model: { provider: "test", id: "larger", name: "Larger" },
        state: { ...snapshot.state, compactionAvailable: true },
      },
      connected: true,
    });
    expect(hook.result.current.disabled).toBe(false);
    hook.rerender({
      current: { ...snapshot, model: { provider: "test", id: "larger", name: "Larger" } },
      connected: true,
    });
    expect(hook.result.current.disabled).toBe(false);
  } finally {
    cleanup();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
