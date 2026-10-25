import { expect, test } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import type { SessionController } from "../session-controller";
import { historyRoute } from "./session-history";
import { allowsRemoteBusiness } from "../remote-access/remote-policy";

const snapshot: SessionSnapshot = {
  sessionId: "synthetic",
  streamId: "first",
  workspaceId: "project",
  model: { id: "test", name: "Test", provider: "example" },
  operation: "idle",
  tools: {},
  state: {
    messages: Array.from({ length: 8 }, (_, timestamp) => ({
      role: "user",
      content: "Request " + timestamp,
      timestamp,
    })),
    isRunning: false,
    hasPendingSave: false,
    outcome: "idle",
    listenerErrors: [],
  },
};

test("history pages exactly three rounds and rejects invalid or replaced stream cursors", async () => {
  const controller = { snapshot } as SessionController;
  const load = (before: string, stream = "first") => {
    const url = new URL(
      "http://localhost/api/sessions/synthetic/history?before=" + before + "&streamId=" + stream,
    );
    return historyRoute(new Request(url), url, "history", controller)!;
  };
  expect(await load("5").json()).toMatchObject({
    start: 2,
    end: 5,
    messages: snapshot.state.messages.slice(2, 5),
  });
  expect(await load("2").json()).toMatchObject({ start: 0, end: 2 });
  for (const value of ["-1", "1.5", "99", ""])
    expect(() => load(value)).toThrow("invalid_history_cursor");
  expect(() => load("5", "old")).toThrow("history_changed");
  expect(allowsRemoteBusiness("/api/sessions/synthetic/history", "GET")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/synthetic/history", "POST")).toBe(false);
});

test("event connection and subsequent state frames send only the newest three rounds", async () => {
  const { SessionEvents } = await import("../session-events");
  const events = new SessionEvents(snapshot.sessionId, () => snapshot);
  const controller = { snapshot, events } as SessionController;
  const url = new URL("http://localhost/api/sessions/synthetic/events");
  const response = historyRoute(new Request(url), url, "events", controller)!;
  const reader = response.body!.getReader();
  try {
    const first = new TextDecoder().decode((await reader.read()).value);
    const frame = JSON.parse(first.split("data: ")[1]!.trim());
    expect(frame.snapshot.state.messages).toHaveLength(3);
    expect(frame.snapshot.history).toMatchObject({ start: 5, total: 8 });
    events.publish({ type: "session.state", snapshot });
    const next = new TextDecoder().decode((await reader.read()).value);
    expect(JSON.parse(next.split("data: ")[1]!.trim()).snapshot.state.messages).toHaveLength(3);
  } finally {
    await reader.cancel();
    events.close();
  }
});
