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
