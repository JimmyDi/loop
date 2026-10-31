import { expect, test } from "vitest";

import type { Frame, SessionSnapshot } from "../../shared/protocol";
import { projectSessionFrame } from "./session-frame";

test("a duplicate frame reuses the view and cross-stream increments require a snapshot", () => {
  const snapshot: SessionSnapshot = {
    sessionId: "example",
    streamId: "stream",
    workspaceId: null,
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
  const frame: Frame = {
    sessionId: "example",
    streamId: "stream",
    seq: 2,
    type: "session.snapshot",
    snapshot,
  };
  const view = projectSessionFrame(undefined, frame)!;
  expect(projectSessionFrame(view, { ...frame, seq: 1 })).toBe(view);
  expect(
    projectSessionFrame(view, {
      sessionId: "example",
      streamId: "other",
      seq: 3,
      type: "run.accepted",
      requestId: "test",
      runId: "test",
    }),
  ).toBeUndefined();
  expect(
    projectSessionFrame(view, {
      ...frame,
      streamId: "other",
      snapshot: { ...snapshot, streamId: "other" },
    })?.snapshot?.streamId,
  ).toBe("other");
});
