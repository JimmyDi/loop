import type { Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { SessionManager } from "../session-manager";
import { canCompactSession, prepareSessionCompaction } from "./session-compaction-plan";

const model: Model<"openai-completions"> = {
  id: "fixture",
  name: "Fixture",
  provider: "fixture",
  api: "openai-completions",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: false,
  contextWindow: 32000,
  maxTokens: 512,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

test.each(["user", undefined] as const)(
  "availability matches execution with projected instructions and model changes (%s)",
  async (placement) => {
    const manager = SessionManager.inMemory();
    expect(canCompactSession(manager, model)).toBe(false);
    const history = [1, 2, 3].map((timestamp) => ({
      role: "user" as const,
      content: "Question",
      timestamp,
    }));
    await manager.commit(history);
    expect(canCompactSession(manager, model)).toBe(false);
    await manager.commit(history, [
      {
        userTurn: 1,
        content: "x".repeat(26000),
        timestamp: 2,
        ...(placement ? { placement } : {}),
      },
    ]);
    expect(canCompactSession(manager, model)).toBe(true);
    expect(prepareSessionCompaction(manager, model).plan.firstKeptMessageIndex).toBe(2);
    expect(canCompactSession(manager, { ...model, contextWindow: 200000 })).toBe(false);
    expect(manager.messages).toEqual(history);
    expect(manager.hasPendingSave).toBe(false);
  },
);
