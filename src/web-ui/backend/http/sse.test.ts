import { expect, test } from "bun:test";

import type { SessionSnapshot } from "../../shared/protocol";
import { SessionEvents } from "../session-events";
import { eventResponse } from "./sse";

test("SSE carries cursors and cancels cleanly without terminating the session stream", async () => {
  const snapshot = { sessionId: "a" } as SessionSnapshot;
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
