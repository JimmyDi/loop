import { expect, test } from "vitest";

import type { ListFrame, SessionSnapshot } from "../shared/protocol";
import { ListEvents } from "./list-events";
import { SessionEvents } from "./session-events";

test("list subscribers receive ordered identities and resynchronize on every connection", () => {
  const events = new ListEvents();
  const first: ListFrame[] = [];
  const second: ListFrame[] = [];
  const disconnect = events.connect((frame) => first.push(frame));
  let closed = false;
  events.connect(
    (frame) => second.push(frame),
    undefined,
    () => {
      closed = true;
    },
  );
  events.publish({ type: "sessions.changed", workspaceId: "p" });
  disconnect();
  events.publish({ type: "projects.changed", workspaceId: "q" });
  expect(first.map((frame) => frame.seq)).toEqual([0, 1]);
  expect(second).toEqual([
    { type: "lists.reset", streamId: events.streamId, seq: 0 },
    { type: "sessions.changed", workspaceId: "p", streamId: events.streamId, seq: 1 },
    { type: "projects.changed", workspaceId: "q", streamId: events.streamId, seq: 2 },
  ]);
  const reconnect: ListFrame[] = [];
  events.connect((frame) => reconnect.push(frame), { streamId: events.streamId, seq: 1 })();
  expect(reconnect).toEqual([{ type: "lists.reset", streamId: events.streamId, seq: 2 }]);
  events.close();
  expect(closed).toBe(true);
  events.publish({ type: "sessions.changed", workspaceId: "p" });
  expect(second).toHaveLength(3);
  let lateClosed = false;
  events.connect(
    (frame) => reconnect.push(frame),
    undefined,
    () => {
      lateClosed = true;
    },
  );
  expect(lateClosed).toBe(true);
  expect(reconnect).toHaveLength(1);
});

test("list watchers ignore token and tool traffic and are released on disposal or shutdown", () => {
  const snapshot = { sessionId: "s" } as SessionSnapshot;
  const session = new SessionEvents("s", () => snapshot);
  const events = new ListEvents();
  const received: ListFrame[] = [];
  events.watch({ workspaceId: "p", events: session });
  events.connect((frame) => received.push(frame));
  session.publish({ type: "run.accepted", requestId: "request", runId: "run" });
  session.publish({
    type: "loop.event",
    runId: "run",
    event: {
      type: "message_end",
      message: { role: "user", content: "Example", timestamp: 1 },
    },
  });
  const assistant = {
    role: "assistant" as const,
    content: [],
    api: "openai-completions" as const,
    provider: "example",
    model: "example",
    stopReason: "stop" as const,
    timestamp: 1,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
  for (let i = 0; i < 100; i++)
    session.publish({
      type: "loop.event",
      runId: "run",
      event: {
        type: "message_update",
        message: assistant,
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: "a",
          partial: assistant,
        },
      },
    });
  session.publish({
    type: "loop.event",
    runId: "run",
    event: {
      type: "message_end",
      message: assistant,
    },
  });
  session.publish({
    type: "loop.event",
    runId: "run",
    event: {
      type: "tool_execution_start",
      toolCallId: "tool",
      toolName: "example",
      args: {},
    },
  });
  expect(received).toHaveLength(3);
  session.publish({ type: "session.state", snapshot });
  expect(received).toHaveLength(4);
  session.close();
  session.publish({ type: "session.state", snapshot });
  expect(received).toHaveLength(4);
  const other = new SessionEvents("other", () => snapshot);
  events.watch({ workspaceId: "q", events: other });
  events.close();
  other.publish({ type: "session.state", snapshot });
  expect(received).toHaveLength(4);
  other.close();
});
