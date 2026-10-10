import { expect, test } from "vitest";

import { validateCompactions } from "./compaction-checkpoint";

test("rejects invalid, duplicate or nonadvancing checkpoint boundaries", () => {
  const messages = [0, 1, 2].map((timestamp) => ({
    role: "user" as const,
    content: "Task",
    timestamp,
  }));
  const checkpoint = {
    id: "00000000-0000-4000-8000-000000000001",
    firstKeptMessageIndex: 1,
    historyMessageCount: 3,
    summary: "Earlier task",
    timestamp: 1,
    provider: "fixture",
    model: "fixture",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 },
  };
  expect(() => validateCompactions([checkpoint], messages)).not.toThrow();
  for (const value of [
    null,
    [checkpoint, checkpoint],
    [{ ...checkpoint, firstKeptMessageIndex: 0 }],
    [{ ...checkpoint, firstKeptMessageIndex: 3 }],
    [{ ...checkpoint, summary: " " }],
    [{ ...checkpoint, historyMessageCount: 4 }],
  ])
    expect(() => validateCompactions(value, messages)).toThrow("Invalid compaction checkpoints");
});
