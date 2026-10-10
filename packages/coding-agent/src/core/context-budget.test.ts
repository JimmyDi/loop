import type { Context, Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import {
  ContextBudgetExceededError,
  estimateTextTokens,
  measureContextBudget,
} from "./context-budget";

const model: Model<"openai-completions"> = {
  id: "test",
  provider: "test",
  api: "openai-completions",
  name: "Test",
  baseUrl: "https://example.invalid",
  input: ["text", "image"],
  reasoning: false,
  contextWindow: 1000,
  maxTokens: 100,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

test("budget includes system instructions, schemas, calls, results and replay signatures", () => {
  const context: Context = {
    systemPrompt: "Project instructions: run verification",
    tools: [{ name: "read", description: "Read a file", parameters: { type: "object" } }],
    messages: [
      { role: "user", content: "Read the configuration", timestamp: 1 },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Inspect it", thinkingSignature: "opaque" },
          { type: "toolCall", id: "call", name: "read", arguments: { path: "config.json" } },
        ],
        api: model.api,
        provider: model.provider,
        model: model.id,
        stopReason: "toolUse",
        timestamp: 2,
        // Billing metadata must not override the full assembled request estimate.
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      },
      {
        role: "toolResult",
        toolName: "read",
        toolCallId: "call",
        content: [{ type: "text", text: "configuration content" }],
        details: { localOnly: "x".repeat(10000) },
        isError: false,
        timestamp: 3,
      },
    ],
  };
  const budget = measureContextBudget(model, context);
  expect(budget.systemTokens).toBeGreaterThan(0);
  expect(budget.toolTokens).toBeGreaterThan(0);
  expect(budget.messageTokens).toBeGreaterThan(100);
  expect(budget.estimatedInputTokens).toBe(
    budget.systemTokens + budget.messageTokens + budget.toolTokens,
  );
  expect(budget.reservedOutputTokens).toBe(100);
  expect(budget.safetyTokens).toBe(50);
  expect(budget.remainingInputTokens).toBe(850 - budget.estimatedInputTokens);
  const changed = structuredClone(context);
  const assistant = changed.messages[1];
  if (assistant?.role !== "assistant") throw new Error("Expected assistant");
  assistant.content = [{ type: "text", text: "x".repeat(4000) }];
  expect(measureContextBudget(model, changed).fits).toBe(false);
  const tool = context.messages[2];
  if (tool?.role !== "toolResult") throw new Error("Expected tool result");
  tool.details = undefined;
  expect(measureContextBudget(model, context)).toEqual(budget);
});

test("exact boundary fits and a single estimated token over is rejected", () => {
  // 834 text tokens + 16 message overhead exactly fill the 850-token input limit.
  const context: Context = {
    messages: [{ role: "user", content: "a".repeat(3336), timestamp: 0 }],
  };
  const exact = measureContextBudget(model, context);
  expect(exact.remainingInputTokens).toBe(0);
  expect(exact.fits).toBe(true);
  context.messages[0]!.content = "a".repeat(3337);
  const exceeded = measureContextBudget(model, context);
  expect(exceeded.remainingInputTokens).toBe(-1);
  expect(exceeded.fits).toBe(false);
  const error = new ContextBudgetExceededError(exceeded);
  exceeded.model = "mutated";
  expect(error.budget.model).toBe("test");
  expect(error.message).toContain("History is preserved");
  expect(error.message).not.toContain("aaaa");
});

test("Unicode estimates account for CJK and emoji; images use a disclosed fixed allowance", () => {
  expect(estimateTextTokens("abcd")).toBe(1);
  expect(estimateTextTokens("中文")).toBe(4);
  expect(estimateTextTokens("😀")).toBe(2);
  const context: Context = {
    messages: [
      {
        role: "user",
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
        timestamp: 0,
      },
    ],
  };
  const small = measureContextBudget(model, context);
  expect(small.messageTokens).toBe(1216);
  context.messages[0]!.content = [
    { type: "image", data: "AAAA".repeat(1000), mimeType: "image/png" },
  ];
  expect(measureContextBudget(model, context)).toEqual(small);
});

test("invalid capacities fail explicitly and response capacity is never silently reduced", () => {
  for (const value of [0, -1, NaN, Infinity, 1.5]) {
    expect(() =>
      measureContextBudget({ ...model, contextWindow: value }, { messages: [] }),
    ).toThrow("positive integers");
    expect(() => measureContextBudget({ ...model, maxTokens: value }, { messages: [] })).toThrow(
      "positive integers",
    );
  }
  const budget = measureContextBudget({ ...model, maxTokens: 1000 }, { messages: [] });
  expect(budget.reservedOutputTokens).toBe(1000);
  expect(budget.inputLimit).toBe(0);
  expect(budget.fits).toBe(false);
  expect(
    measureContextBudget({ ...model, contextWindow: 200000 }, { messages: [] }).safetyTokens,
  ).toBe(4096);
});

test("request reserves can be smaller than model capacity without altering model metadata", () => {
  const context: Context = { messages: [{ role: "user", content: "Hello", timestamp: 0 }] };
  const budget = measureContextBudget(model, context, 40);
  expect(budget.reservedOutputTokens).toBe(40);
  expect(budget.inputLimit).toBe(910);
  expect(model.maxTokens).toBe(100);
  for (const reserve of [0, -1, 1.5, NaN, 101]) {
    expect(() => measureContextBudget(model, context, reserve)).toThrow("Reserved output");
  }
});
