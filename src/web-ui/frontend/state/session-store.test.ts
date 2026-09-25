import { expect, test } from "bun:test";

import type { Frame, SessionSnapshot } from "../../shared/protocol";
import { useSessions } from "./session-store";

test("session store ignores duplicates, rejects gaps, and replaces on new streams", () => {
  useSessions.setState({ views: {} });
  const snapshot: SessionSnapshot = {
    streamId: "stream",
    sessionId: "s",
    workspaceId: "p",
    model: { id: "test", provider: "test", name: "Test" },
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
  const frame: Frame = {
    type: "session.snapshot",
    seq: 0,
    sessionId: "s",
    streamId: "stream",
    snapshot,
  };

  expect(useSessions.getState().frame(frame)).toBe(true);
  const accepted: Frame = {
    type: "run.accepted",
    seq: 1,
    sessionId: "s",
    streamId: "stream",
    requestId: "r",
    runId: "run",
  };

  expect(useSessions.getState().frame(accepted)).toBe(true);
  expect(useSessions.getState().frame(accepted)).toBe(true);
  expect(useSessions.getState().frame({ ...accepted, seq: 3 })).toBe(false);
  expect(useSessions.getState().frame({ ...frame, streamId: "new" })).toBe(true);
  expect(useSessions.getState().views.s?.snapshot?.operation).toBe("idle");
});
