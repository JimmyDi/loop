import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { SessionEvents } from "../session-events";
import { ListEvents } from "../list-events";
import { eventResponse } from "./sse";

test("SSE carries cursors and cancels cleanly without terminating the session stream", async () => {
  const snapshot: SessionSnapshot = {
    sessionId: "a",
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
  const events = new SessionEvents("a", () => snapshot);
  const response = eventResponse(events, new Request("http://localhost/api/events"));
  const reader = response.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);

  expect(first).toContain("session.snapshot");
  expect(first).toContain("id: " + events.streamId + ":0");
  await reader.cancel();
  expect(() => events.publish({ type: "run.accepted", runId: "a", requestId: "b" })).not.toThrow();
  events.close();
});

test("observable heartbeats leave the business cursor unchanged", async () => {
  vi.useFakeTimers();
  const events = new ListEvents();
  const reader = eventResponse(
    events,
    new Request("http://localhost/api/events"),
  ).body!.getReader();
  try {
    const first = new TextDecoder().decode((await reader.read()).value);
    const pulse = reader.read();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(new TextDecoder().decode((await pulse).value)).toBe("event: heartbeat\ndata: {}\n\n");
    events.publish({ type: "sessions.changed", workspaceId: "example" });
    const next = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain(":0");
    expect(next).toContain(":1");
  } finally {
    await reader.cancel();
    vi.useRealTimers();
  }
});

test("list SSE abort, cancellation and shutdown close only the intended streams", async () => {
  const events = new ListEvents();
  const abort = new AbortController();
  const first = eventResponse(
    events,
    new Request("http://localhost/api/workspaces/events", {
      signal: abort.signal,
    }),
  ).body!.getReader();
  const second = eventResponse(
    events,
    new Request("http://localhost/api/workspaces/events"),
  ).body!.getReader();
  expect(new TextDecoder().decode((await first.read()).value)).toContain("lists.reset");
  await second.read();
  abort.abort();
  expect((await first.read()).done).toBe(true);
  events.publish({ type: "sessions.changed", workspaceId: "p" });
  expect(new TextDecoder().decode((await second.read()).value)).toContain("sessions.changed");
  await second.cancel();
  const last = eventResponse(
    events,
    new Request("http://localhost/api/workspaces/events"),
  ).body!.getReader();
  await last.read();
  events.close();
  expect((await last.read()).done).toBe(true);
});
