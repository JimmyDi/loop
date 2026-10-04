import { expect, test } from "bun:test";

import type { SessionSnapshot, Message } from "./protocol";
import { applyEvent, applyFrame } from "./session-projection";

test("cumulative drafts replace rather than append and full snapshots replace history", () => {
  const initial: SessionSnapshot = {
    streamId: "stream",
    sessionId: "session",
    workspaceId: "project",
    model: { id: "test", provider: "test", name: "Test" },
    operation: "prompt",
    tools: {},
    state: {
      messages: [],
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const message = { role: "assistant", content: [{ type: "text", text: "hello" }] } as Extract<
    Message,
    { role: "assistant" }
  >;
  const started = applyEvent(initial, { type: "message_start", message }, 0);
  const ended = applyEvent(started, { type: "message_end", message }, 0);
  const repeated = applyEvent(ended, { type: "message_end", message }, 0);

  expect(started.state.messages).toHaveLength(0);
  expect(started.state.draft).toEqual(message);
  expect(repeated.state.messages).toHaveLength(1);
  expect(repeated.state.draft).toBeUndefined();
  const timing = { userMessageIndex: 0, startedAt: 1000 };
  const timed = applyEvent(initial, { type: "run_timing", timing });
  const stopped = applyEvent(timed, {
    type: "run_timing",
    timing: { ...timing, finishedAt: 4000 },
  });
  expect(timed.state.runTimings).toEqual([timing]);
  expect(stopped.state.runTimings).toEqual([{ ...timing, finishedAt: 4000 }]);
  expect(initial.state.runTimings).toBeUndefined();
  const permitted = applyEvent(initial, {
    type: "permission_changed",
    permissionPreset: "read-only",
  });
  expect(permitted.state.permissionPreset).toBe("read-only");
  expect(initial.state.permissionPreset).toBeUndefined();
  const thinking = applyEvent(
    started,
    {
      type: "message_update",
      message,
      assistantMessageEvent: { type: "thinking_start", contentIndex: 0, partial: message },
    },
    0,
  );
  expect(thinking.draftPhase).toBe("thinking");
  expect(applyEvent(thinking, { type: "message_start", message }, 1).draftPhase).toBeUndefined();
  expect(applyEvent(thinking, { type: "message_end", message }, 0).draftPhase).toBeUndefined();
  expect(
    applyFrame(thinking, {
      type: "run.accepted",
      streamId: "stream",
      sessionId: "session",
      seq: 1,
      requestId: "request",
      runId: "run",
    })?.draftPhase,
  ).toBeUndefined();
  expect(
    applyFrame(repeated, {
      type: "session.snapshot",
      streamId: "new",
      seq: 0,
      sessionId: "session",
      snapshot: initial,
    })?.state.messages,
  ).toHaveLength(0);
});
