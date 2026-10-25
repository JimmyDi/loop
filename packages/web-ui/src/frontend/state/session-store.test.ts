import { expect, test } from "vitest";

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

test("history prepends reject stale pages and preserve cursor before resetting to latest", async () => {
  const { pageSnapshot } = await import("../../shared/session-history");
  const messages = Array.from({ length: 8 }, (_, timestamp) => ({
    role: "user" as const,
    content: "Request " + timestamp,
    timestamp,
  }));
  const snapshot: SessionSnapshot = pageSnapshot({
    streamId: "stream",
    sessionId: "paged",
    workspaceId: "project",
    model: { id: "test", name: "Test", provider: "example" },
    operation: "idle",
    tools: {},
    state: {
      messages,
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  });
  useSessions.setState({
    views: { paged: { snapshot, cursor: { streamId: "stream", seq: 10 }, connected: true } },
  });
  const page = {
    streamId: "stream",
    start: 2,
    end: 5,
    total: 8,
    userStart: 2,
    messages: messages.slice(2, 5),
  };
  expect(useSessions.getState().prepend("paged", { ...page, streamId: "old" })).toBe(false);
  expect(useSessions.getState().prepend("paged", page)).toBe(true);
  expect(useSessions.getState().prepend("paged", page)).toBe(false);
  expect(useSessions.getState().views.paged!.snapshot!.state.messages).toEqual(messages.slice(2));
  expect(useSessions.getState().views.paged!.cursor?.seq).toBe(10);
  useSessions.getState().latest("paged");
  expect(useSessions.getState().views.paged!.snapshot!.state.messages).toEqual(messages.slice(5));
  expect(useSessions.getState().views.paged!.snapshot!.history?.start).toBe(5);
  useSessions.setState({ views: {} });
});
