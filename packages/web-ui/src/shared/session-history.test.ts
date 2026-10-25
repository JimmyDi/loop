import { expect, test } from "vitest";

import { pageSnapshot, mergeHistorySnapshot } from "./session-history";
import { applyEvent } from "./session-projection";
import type { Message, SessionSnapshot } from "./protocol";

const messages: Message[] = Array.from({ length: 8 }, (_, timestamp) => ({
  role: "user",
  content: "Request " + timestamp,
  timestamp,
}));
const snapshot: SessionSnapshot = {
  sessionId: "synthetic",
  streamId: "first",
  workspaceId: "project",
  model: { id: "test", name: "Test", provider: "example" },
  operation: "idle",
  tools: {},
  state: { messages, isRunning: false, hasPendingSave: false, outcome: "idle", listenerErrors: [] },
};

test("paged snapshots retain global message positions during events, prepends and reconnects", () => {
  const latest = pageSnapshot(snapshot);
  expect(latest.history).toEqual({ start: 5, total: 8, userStart: 5 });
  expect(latest.state.messages).toEqual(messages.slice(5));
  const message: Message = { role: "user", content: "New request", timestamp: 9 };
  const updated = applyEvent(latest, { type: "message_end", message }, 8);
  expect(updated.state.messages).toEqual([...messages.slice(5), message]);
  expect(updated.history?.total).toBe(9);
  const expanded = {
    ...latest,
    history: { start: 2, total: 8, userStart: 2 },
    state: { ...latest.state, messages: messages.slice(2) },
  };
  const newer = pageSnapshot({
    ...snapshot,
    state: { ...snapshot.state, messages: [...messages, message] },
  });
  expect(mergeHistorySnapshot(expanded, newer).state.messages).toEqual([
    ...messages.slice(2),
    message,
  ]);
  expect(mergeHistorySnapshot(expanded, { ...newer, streamId: "replacement" })).toEqual({
    ...newer,
    streamId: "replacement",
  });
});
