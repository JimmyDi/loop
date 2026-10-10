import { expect, test } from "vitest";

import type { SessionSnapshot, Message } from "./protocol";
import { applyEvent, applyFrame } from "./session-projection";

test("cumulative drafts replace rather than append and full snapshots replace history", () => {
  const initial: SessionSnapshot = {
    streamId: "stream",
    sessionId: "session",
    workspaceId: "project",
    model: { id: "test", provider: "test", name: "Test" },
    operation: "prompt",
    tools: {},
    state: {
      messages: [],
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const message = { role: "assistant", content: [{ type: "text", text: "hello" }] } as Extract<
    Message,
    { role: "assistant" }
  >;
  const started = applyEvent(initial, { type: "message_start", message }, 0);
  const ended = applyEvent(started, { type: "message_end", message }, 0);
  const repeated = applyEvent(ended, { type: "message_end", message }, 0);

  expect(started.state.messages).toHaveLength(0);
  expect(started.state.draft).toEqual(message);
  expect(repeated.state.messages).toHaveLength(1);
  expect(repeated.state.draft).toBeUndefined();
  const timing = { userMessageIndex: 0, startedAt: 1000 };
  const working = applyEvent(initial, { type: "prompt_timing", timing });
  const finished = applyEvent(working, {
    type: "prompt_timing",
    timing: { ...timing, finishedAt: 30000 },
  });
  expect(finished.state.promptTimings).toEqual([{ ...timing, finishedAt: 30000 }]);
  expect(initial.state.promptTimings).toBeUndefined();
  const permitted = applyEvent(initial, {
    type: "permission_changed",
    permissionPreset: "read-only",
  });
  expect(permitted.state.permissionPreset).toBe("read-only");
  expect(initial.state.permissionPreset).toBeUndefined();
  const skills = [
    {
      id: "example",
      name: "example",
      path: "skills/example/SKILL.md",
      content: "Historical instructions",
      revision: "first",
    },
  ];
  const loaded = applyEvent(initial, { type: "skills_loaded", userTurn: 0, skills });
  expect(loaded.state.skillLoads).toEqual([{ userTurn: 0, skills }]);
  expect(initial.state.skillLoads).toBeUndefined();
  const budget = {
    provider: "test",
    model: "test",
    contextWindow: 4096,
    systemTokens: 100,
    messageTokens: 200,
    toolTokens: 50,
    estimatedInputTokens: 350,
    reservedOutputTokens: 512,
    safetyTokens: 205,
    inputLimit: 3379,
    remainingInputTokens: 3029,
    fits: true,
  };
  const measured = applyEvent(initial, { type: "context_budget", budget });
  expect(measured.state.contextBudget).toEqual(budget);
  expect(initial.state.contextBudget).toBeUndefined();
  const compacting = applyEvent(measured, {
    type: "compaction_start",
    startedAt: 1000,
    historyMessageCount: 4,
  });
  expect(compacting.operation).toBe(measured.operation);
  expect(compacting.state.activeCompaction).toEqual({ startedAt: 1000, historyMessageCount: 4 });
  const checkpoint = {
    id: "fixture-checkpoint",
    firstKeptMessageIndex: 2,
    historyMessageCount: 4,
    timestamp: 2000,
  };
  const compacted = applyEvent(compacting, { type: "compaction_end", checkpoint });
  expect(compacted.state.activeCompaction).toBeUndefined();
  expect(compacted.state.compaction).toEqual(checkpoint);
  expect(
    applyEvent(compacting, { type: "compaction_end", error: "Cancelled" }).state.compaction,
  ).toBeUndefined();
  expect(
    applyFrame(measured, {
      type: "run.accepted",
      streamId: "stream",
      seq: 1,
      sessionId: "session",
      runId: "next-run",
      requestId: "next-request",
    })?.state.contextBudget,
  ).toBeUndefined();
  const request = {
    sessionId: "session",
    requestId: "approval",
    toolCallId: "call",
    toolName: "write",
    reason: "Review operation",
    policy: "ask" as const,
    createdAt: 1,
    expiresAt: null,
  };
  const requested = applyEvent(initial, { type: "approval_requested", request });
  const duplicate = applyEvent(requested, { type: "approval_requested", request });
  expect(duplicate.state.pendingApprovals).toEqual([request]);
  expect(initial.state.pendingApprovals).toBeUndefined();
  const resolved = applyEvent(duplicate, {
    type: "approval_resolved",
    result: { request, outcome: "cancelled", resolvedAt: 2 },
  });
  expect(resolved.state.pendingApprovals).toEqual([]);
  expect(requested.state.pendingApprovals).toEqual([request]);
  expect(resolved.tools).toEqual(initial.tools);
  expect(
    applyFrame(repeated, {
      type: "session.snapshot",
      streamId: "new",
      seq: 0,
      sessionId: "session",
      snapshot: initial,
    })?.state.messages,
  ).toHaveLength(0);
});
