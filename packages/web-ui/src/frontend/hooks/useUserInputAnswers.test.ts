import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { useUserInputAnswers } from "./useUserInputAnswers";
import { useSessions } from "../state/session-store";

test("last-page Skip submits explicit skips once and connection guards all actions", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const sessions = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const calls: unknown[] = [];
  globalThis.fetch = (async (_url, options) => {
    calls.push(JSON.parse(String(options?.body)));
    return Response.json({});
  }) as typeof fetch;
  try {
    const request = {
      sessionId: "s",
      requestId: "r",
      createdAt: 0,
      questions: [{ id: "q", text: "Details?" }],
    };
    const hook = renderHook(({ connected }) => useUserInputAnswers(request, connected), {
      initialProps: { connected: false },
    });
    act(() => {
      hook.result.current.skip();
      hook.result.current.advance();
    });
    expect(calls).toEqual([]);
    hook.rerender({ connected: true });
    expect(hook.result.current.canAdvance).toBe(false);
    await act(async () => {
      hook.result.current.skip();
      hook.result.current.skip();
    });
    expect(calls).toEqual([{ answers: [{ questionId: "q", type: "skipped" }] }]);
  } finally {
    cleanup();
    useSessions.setState(sessions, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
