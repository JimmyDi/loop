import type { Message, Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { SessionManager } from "../session-manager";
import { unavailableModel } from "../models/unavailable-model";
import type { SessionOptions } from "../types/session";
import { measureContextBudget } from "../context-budget";
import { buildSessionModelContext } from "./session-model-context";
import { estimateSessionContextBudget } from "./session-context-budget";

test("idle estimate counts summary, retained Skill context and declarations without provider calls", async () => {
  const model: Model<"openai-completions"> = {
    id: "fixture",
    provider: "fixture",
    api: "openai-completions",
    name: "Fixture",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 32000,
    maxTokens: 512,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const manager = SessionManager.inMemory();
  const options: SessionOptions = {
    model,
    sessionManager: manager,
    systemPrompt: "Project rules",
    tools: [
      {
        name: "read",
        description: "Read",
        parameters: { type: "object" },
        execute: () => {
          throw new Error("Must not execute");
        },
      },
    ],
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {
        throw new Error("Must not authenticate");
      },
      streamSimple: () => {
        throw new Error("Must not dispatch");
      },
    },
  };
  expect(estimateSessionContextBudget(options, model)).toBeUndefined();
  await manager.commit([{ role: "user", content: "Saved history", timestamp: 0 }]);
  expect(
    estimateSessionContextBudget(options, unavailableModel("missing", "missing")),
  ).toBeUndefined();
  const history: Message[] = [
    { role: "user", content: "x".repeat(26000), timestamp: 1 },
    { role: "user", content: "Latest question", timestamp: 2 },
  ];
  const snapshots = [
    {
      userTurn: 1,
      content: "<skill>Review carefully</skill>",
      placement: "user" as const,
      timestamp: 2,
    },
  ];
  await manager.commit(history, snapshots);
  const before = estimateSessionContextBudget(options, model)!;
  const checkpoint = {
    id: "00000000-0000-4000-8000-000000000001",
    firstKeptMessageIndex: 1,
    historyMessageCount: 2,
    summary: "Earlier task completed",
    timestamp: 3,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 123,
      output: 15,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 138,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
  await manager.commit(history, undefined, undefined, { compactions: [checkpoint] });
  const { systemPrompt, tools } = buildSessionModelContext(options, model);
  const expected = measureContextBudget(model, {
    systemPrompt,
    tools: tools.map(({ name, description, parameters }) => ({ name, description, parameters })),
    messages: [
      {
        role: "user",
        content:
          "The conversation history before this point was compacted into the following summary:\n\n<summary>\nEarlier task completed\n</summary>",
        timestamp: 3,
      },
      { role: "user", content: "<skill>Review carefully</skill>\n\nLatest question", timestamp: 2 },
    ],
  });
  const budget = estimateSessionContextBudget(options, model)!;
  expect(budget).toEqual(expected);
  expect(budget.estimatedInputTokens).toBeLessThan(before.estimatedInputTokens);
  expect(budget.systemTokens).toBeGreaterThan(0);
  expect(budget.toolTokens).toBeGreaterThan(0);
  expect(manager.messages).toEqual(history);
  expect(manager.getRuntimeContexts()).toEqual(snapshots);
  expect(manager.getCompactions()).toEqual([checkpoint]);
  expect(manager.hasPendingSave).toBe(false);
  const capped = estimateSessionContextBudget({ ...options, maxTokens: 128 }, model)!;
  expect(capped.reservedOutputTokens).toBe(128);
  expect(capped.estimatedInputTokens).toBe(budget.estimatedInputTokens);
  await manager.commit([
    ...history,
    {
      role: "assistant",
      content: [{ type: "text", text: "Incomplete" + "x".repeat(1000) }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      stopReason: "error",
      errorMessage: "Provider unavailable",
      timestamp: 4,
      usage: checkpoint.usage,
    },
  ]);
  expect(estimateSessionContextBudget(options, model)).toEqual(expected);
});
