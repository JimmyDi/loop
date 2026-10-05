import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionSnapshot } from "../../../shared/protocol";
import { SessionApprovals } from "./SessionApprovals";
import "../../i18n/setup";

test("approval cards filter foreign sessions and show completion, timeout and cancellation outcomes", () => {
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
  const outcomes = {
    "allowed-once": "Allowed once",
    rejected: "Rejected",
    cancelled: "Approval cancelled",
    "timed-out": "Approval expired",
    unavailable: "Approval interface unavailable",
  } as const;
  for (const [outcome, label] of Object.entries(outcomes)) {
    const next = {
      ...snapshot,
      sessionId: "first",
      state: { ...snapshot.state, pendingApprovals: [] },
      lastApproval: { request, outcome: outcome as keyof typeof outcomes, resolvedAt: 1 },
    };
    const html = renderToStaticMarkup(<SessionApprovals snapshot={next} connected />);
    expect(html).toContain(label);
    expect(html).not.toContain("<button");
  }
});
