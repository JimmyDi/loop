import { expect, test } from "bun:test";

import type { Frame, SessionSnapshot } from "../shared/protocol";
import { SessionEvents } from "./session-events";

test("replays contiguous frames or replaces with a current snapshot when buffer expires", () => {
  const snapshot: SessionSnapshot = {
    streamId: "test",
    sessionId: "session",
    workspaceId: "project",
    model: { provider: "test", id: "test", name: "Test" },
    operation: "idle",
    tools: {},
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const events = new SessionEvents("session", () => snapshot, 2);
  const first: Frame[] = [];
  const unsubscribe = events.connect((frame) => first.push(frame));

  events.publish({ type: "run.accepted", runId: "a", requestId: "a" });
  unsubscribe();
  events.publish({ type: "run.accepted", runId: "b", requestId: "b" });

  const replay: Frame[] = [];

  events.connect((frame) => replay.push(frame), { streamId: events.streamId, seq: 1 })();
  expect(replay.map((frame) => frame.seq)).toEqual([2]);
  events.publish({ type: "run.accepted", runId: "c", requestId: "c" });

  const expired: Frame[] = [];

  events.connect((frame) => expired.push(frame), { streamId: events.streamId, seq: 0 })();
  expect(expired[0]?.type).toBe("session.snapshot");
  expect(expired[0]?.seq).toBe(3);
  expect(first.map((frame) => frame.seq)).toEqual([0, 1]);

  const current: Frame[] = [];

  events.connect((frame) => current.push(frame), { streamId: events.streamId, seq: 3 })();
  expect(current[0]?.type).toBe("session.snapshot");
  expect(current[0]?.seq).toBe(3);
});
