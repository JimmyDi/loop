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
  const targetUrl = new URL(
    "http://localhost/api/sessions/synthetic/history?target=1&streamId=first",
  );
  expect(
    await historyRoute(new Request(targetUrl), targetUrl, "history", controller)!.json(),
  ).toMatchObject({ start: 0, end: 3, messages: snapshot.state.messages.slice(0, 3) });
  targetUrl.searchParams.delete("target");
  targetUrl.searchParams.set("after", "4");
  expect(
    await historyRoute(new Request(targetUrl), targetUrl, "history", controller)!.json(),
  ).toMatchObject({ start: 4, end: 7 });
  targetUrl.searchParams.set("target", "0");
  expect(() => historyRoute(new Request(targetUrl), targetUrl, "history", controller)).toThrow(
    "invalid_history_cursor",
  );
});

test("target windows include only the adjacent rounds, including full assistant content", async () => {
  const messages = snapshot.state.messages.flatMap((message) => [
    message,
    {
      ...message,
      role: "toolResult",
      toolCallId: "example",
      toolName: "example",
      content: [],
      isError: false,
    },
  ]) as SessionSnapshot["state"]["messages"];
  const controller = {
    snapshot: { ...snapshot, state: { ...snapshot.state, messages } },
  } as SessionController;
  const load = async (target: number) => {
    const url = new URL(
      "http://localhost/api/sessions/synthetic/history?streamId=first&target=" + target,
    );
    return historyRoute(new Request(url), url, "history", controller)!.json();
  };
  expect(await load(6)).toMatchObject({
    start: 4,
    end: 10,
    userStart: 2,
    messages: messages.slice(4, 10),
  });
  expect(await load(0)).toMatchObject({ start: 0, end: 4, messages: messages.slice(0, 4) });
  expect(await load(14)).toMatchObject({ start: 12, end: 16, messages: messages.slice(12) });
  await expect(load(7)).rejects.toThrow("invalid_history_cursor");
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
