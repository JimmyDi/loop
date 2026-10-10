import type { Message } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { estimateMessageTokens } from "../context-budget";
import { projectModelInput } from "../model-input-projection";
import type { RuntimeContextSnapshot } from "../runtime-context";
import type { CompactionCheckpoint } from "./compaction-checkpoint";
import { NothingToCompactError } from "./compaction-error";
import { planCompaction } from "./compaction-plan";

const project = (messages: Message[], snapshots: RuntimeContextSnapshot[] = []) =>
  projectModelInput(messages, snapshots, {
    historyMessageCount: messages.length,
    sources: messages.map((_, messageIndex) => ({ type: "history", messageIndex })),
  });

test("chooses complete user turns by size and always preserves the newest oversized turn", () => {
  const messages: Message[] = [
    { role: "user", content: "Old goal", timestamp: 1 },
    { role: "user", content: "x".repeat(2000), timestamp: 2 },
    { role: "user", content: "Latest question", timestamp: 3 },
  ];
  const plan = planCompaction(messages, project(messages), undefined, 100);
  expect(plan.firstKeptMessageIndex).toBe(2);
  expect(plan.messages).toEqual(messages.slice(0, 2));
  expect(
    planCompaction(messages.slice(0, 2), project(messages.slice(0, 2)), undefined, 100),
  ).toMatchObject({ firstKeptMessageIndex: 1, messages: messages.slice(0, 1) });
});

test("nothing to compact when every turn fits, including the exact retention boundary", () => {
  const messages: Message[] = [1, 2].map((timestamp) => ({
    role: "user",
    content: "Task",
    timestamp,
  }));
  const size = messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
  for (const limit of [size, size + 1])
    expect(() => planCompaction(messages, project(messages), undefined, limit)).toThrow(
      NothingToCompactError,
    );
  expect(
    planCompaction(messages, project(messages), undefined, size - 1).firstKeptMessageIndex,
  ).toBe(1);
  for (const history of [[], messages.slice(0, 1)])
    expect(() => planCompaction(history, project(history))).toThrow(NothingToCompactError);
});

test.each(["user", undefined] as const)(
  "counts projected Skill and legacy sizes without introducing extra turns (%s)",
  (placement) => {
    const messages: Message[] = [1, 2, 3].map((timestamp) => ({
      role: "user",
      content: "Question",
      timestamp,
    }));
    expect(() => planCompaction(messages, project(messages), undefined, 100)).toThrow(
      NothingToCompactError,
    );
    const snapshot: RuntimeContextSnapshot = {
      userTurn: 1,
      content: "<skill>" + "x".repeat(2000) + "</skill>",
      timestamp: 2,
      ...(placement ? { placement } : {}),
    };
    const projected = project(messages, [snapshot]);
    const plan = planCompaction(messages, projected, undefined, 100);
    expect(plan.firstKeptMessageIndex).toBe(2);
    expect(plan.messages).toEqual(projected.messages.slice(0, placement ? 2 : 3));
    expect(JSON.stringify(plan.messages)).toContain(snapshot.content);
    const oneTurn = messages.slice(1, 2);
    expect(() => planCompaction(oneTurn, project(oneTurn, [{ ...snapshot, userTurn: 0 }]))).toThrow(
      NothingToCompactError,
    );
  },
);

test("ignores an already summarized prefix and preserves a complete tool-call/result turn", () => {
  const messages: Message[] = [
    { role: "user", content: "x".repeat(2000), timestamp: 1 },
    { role: "user", content: "Review", timestamp: 2 },
    {
      role: "assistant",
      api: "openai-completions",
      provider: "fixture",
      model: "fixture",
      timestamp: 2,
      stopReason: "toolUse",
      content: [{ type: "toolCall", id: "read-1", name: "read", arguments: {} }],
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    },
    {
      role: "toolResult",
      toolName: "read",
      toolCallId: "read-1",
      timestamp: 2,
      content: [{ type: "text", text: "Result" }],
      isError: false,
    },
    { role: "user", content: "Continue", timestamp: 3 },
  ];
  const previous: CompactionCheckpoint = {
    id: "00000000-0000-4000-8000-000000000001",
    firstKeptMessageIndex: 1,
    historyMessageCount: 5,
    summary: "Prior work",
    timestamp: 1,
    provider: "fixture",
    model: "fixture",
    usage: (messages[2] as Extract<Message, { role: "assistant" }>).usage,
  };
  const projected = project(messages);
  const recentTokens = messages
    .slice(1)
    .reduce((sum, message) => sum + estimateMessageTokens(message), 0);
  expect(() => planCompaction(messages, projected, previous, recentTokens)).toThrow(
    NothingToCompactError,
  );
  const plan = planCompaction(messages, projected, previous, recentTokens - 1);
  expect(plan.firstKeptMessageIndex).toBe(4);
  expect(plan.messages).toEqual(messages.slice(1, 4));
});
