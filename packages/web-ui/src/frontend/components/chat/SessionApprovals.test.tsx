import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionSnapshot } from "../../../shared/protocol";
import { SessionApprovals } from "./SessionApprovals";
import "../../i18n/setup";

test("approval cards show only pending requests for the current session", () => {
  const request = {
    sessionId: "first",
    requestId: "request",
    toolName: "write",
    toolCallId: "call",
    reason: "Example",
    policy: "ask" as const,
    createdAt: Date.now(),
    expiresAt: null,
  };
  const snapshot = {
    sessionId: "second",
    state: { pendingApprovals: [request] },
  } as SessionSnapshot;
  expect(renderToStaticMarkup(<SessionApprovals snapshot={snapshot} connected />)).toBe("");
  const current = { ...snapshot, sessionId: "first" };
  const pending = renderToStaticMarkup(<SessionApprovals snapshot={current} connected />);
  expect(pending).toContain("Waiting for approval");
  expect(pending).toContain(">Allow once</button>");
  expect(pending).toContain(">Deny</button>");
  for (const outcome of [
    "allowed-once",
    "rejected",
    "cancelled",
    "timed-out",
    "unavailable",
  ] as const) {
    const next = {
      ...current,
      state: { ...snapshot.state, pendingApprovals: [] },
      lastApproval: { request, outcome, resolvedAt: 1 },
    };
    expect(renderToStaticMarkup(<SessionApprovals snapshot={next} connected />)).toBe("");
    expect(
      renderToStaticMarkup(
        <SessionApprovals
          snapshot={{ ...next, state: { ...next.state, pendingApprovals: [request] } }}
          connected
        />,
      ),
    ).toContain("Waiting for approval");
  }
});
