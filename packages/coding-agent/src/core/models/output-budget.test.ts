import type { Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { adjustMaxTokensForThinking } from "@earendil-works/pi-ai/api/simple-options";
import { expect, test } from "vitest";

import { measureContextBudget } from "../context-budget";
import { resolveOutputBudget, withOutputBudget } from "./output-budget";

const model: Model<"anthropic-messages"> = {
  id: "fixture",
  name: "Fixture",
  api: "anthropic-messages",
  provider: "fixture",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: true,
  contextWindow: 200000,
  maxTokens: 128000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

test("reserves fixed thinking once, adaptive thinking within the cap and unknown APIs conservatively", () => {
  const options: SimpleStreamOptions = { maxTokens: 16000, reasoning: "medium" };
  expect(resolveOutputBudget(model, options, adjustMaxTokensForThinking)).toBe(24192);
  expect(resolveOutputBudget(model, { maxTokens: 16000 }, adjustMaxTokensForThinking)).toBe(16000);
  expect(
    resolveOutputBudget(
      { ...model, compat: { forceAdaptiveThinking: true } },
      options,
      adjustMaxTokensForThinking,
    ),
  ).toBe(16000);
  expect(resolveOutputBudget(model, undefined, adjustMaxTokensForThinking)).toBe(128000);
  expect(
    resolveOutputBudget(
      model,
      { maxTokens: 125000, reasoning: "high" },
      adjustMaxTokensForThinking,
    ),
  ).toBe(128000);
  expect(
    resolveOutputBudget(
      model,
      { ...options, thinkingBudgets: { medium: 5000 } },
      adjustMaxTokensForThinking,
    ),
  ).toBe(21000);
  expect(
    resolveOutputBudget({ ...model, api: "unknown-api" }, options, adjustMaxTokensForThinking),
  ).toBe(128000);
});

test("accounts for Responses minimum, unsupported caps and OpenAI sampling overrides", () => {
  const openai = { ...model, api: "openai-responses" as const };
  expect(resolveOutputBudget(openai, { maxTokens: 1 }, adjustMaxTokensForThinking)).toBe(16);
  expect(
    resolveOutputBudget(
      { ...openai, compat: { supportsMaxOutputTokens: false } },
      { maxTokens: 16000 },
      adjustMaxTokensForThinking,
    ),
  ).toBe(128000);
  expect(
    resolveOutputBudget(
      { ...openai, samplingParams: { max_output_tokens: 20000 } },
      { maxTokens: 16000, samplingParams: { max_output_tokens: 24000 } },
      adjustMaxTokensForThinking,
    ),
  ).toBe(24000);
  for (const maxTokens of [0, -1, NaN, Infinity, 1.5]) {
    expect(() => resolveOutputBudget(openai, { maxTokens }, adjustMaxTokensForThinking)).toThrow(
      "positive safe integer",
    );
  }
  expect(() =>
    resolveOutputBudget(
      openai,
      { samplingParams: { max_output_tokens: 200000 } },
      adjustMaxTokensForThinking,
    ),
  ).toThrow("exceeds model");
  expect(() =>
    resolveOutputBudget(
      openai,
      { samplingParams: { max_output_tokens: "16000" } },
      adjustMaxTokensForThinking,
    ),
  ).toThrow("positive safe integer");
});

test("observes payload limits after caller changes without replacing reserves or retaining bodies", async () => {
  const budget = measureContextBudget(model, { messages: [] }, 24192);
  const observed: number[] = [];
  const replacement = { max_tokens: 20000, messages: [] };
  const wrapped = withOutputBudget(
    { maxTokens: 16000, onPayload: async () => replacement },
    budget,
    (next) => {
      expect(next.reservedOutputTokens).toBe(24192);
      expect(next.inputLimit).toBe(budget.inputLimit);
      observed.push(next.requestOutputTokenLimit!);
    },
  );
  expect(wrapped.maxTokens).toBe(16000);
  expect(await wrapped.onPayload!({ max_tokens: 24192 }, model)).toBe(replacement);
  expect(observed).toEqual([20000]);
  expect(budget.requestOutputTokenLimit).toBeUndefined();
  for (const field of ["max_tokens", "max_completion_tokens", "max_output_tokens"]) {
    const unchanged = withOutputBudget(undefined, budget, (next) => {
      observed.push(next.requestOutputTokenLimit!);
    });
    expect(await unchanged.onPayload!({ [field]: 12000 }, model)).toBeUndefined();
    await expect(unchanged.onPayload!({ [field]: 30000 }, model)).rejects.toThrow("reserved");
    await expect(unchanged.onPayload!({ [field]: NaN }, model)).rejects.toThrow("positive");
  }
  expect(observed).toEqual([20000, 12000, 12000, 12000]);
  const mutated = withOutputBudget(
    {
      onPayload: (payload) => {
        (payload as Record<string, unknown>).max_tokens = 30000;
      },
    },
    budget,
  );
  await expect(mutated.onPayload!({ max_tokens: 1000 }, model)).rejects.toThrow("reserved");
  await expect(wrapped.onPayload!({}, model)).resolves.toBe(replacement);
  await expect(withOutputBudget(undefined, budget).onPayload!({}, model)).rejects.toThrow(
    "omitted",
  );
  await expect(
    withOutputBudget(undefined, measureContextBudget(model, { messages: [] })).onPayload!(
      {},
      model,
    ),
  ).resolves.toBeUndefined();
});

test("cancellation during a payload callback prevents observations and dispatch", async () => {
  const controller = new AbortController();
  const wrapped = withOutputBudget(
    {
      signal: controller.signal,
      onPayload: () => {
        controller.abort(new Error("Cancelled payload"));
      },
    },
    measureContextBudget(model, { messages: [] }),
    () => {
      throw new Error("Must not observe cancelled payload");
    },
  );
  await expect(wrapped.onPayload!({ max_tokens: 1000 }, model)).rejects.toThrow(
    "Cancelled payload",
  );
});
