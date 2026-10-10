import type { Api, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";

import type { ContextBudget } from "../context-budget";

type AdjustThinking = (
  maxTokens: number,
  modelMaxTokens: number,
  reasoning: NonNullable<SimpleStreamOptions["reasoning"]>,
  budgets?: SimpleStreamOptions["thinkingBudgets"],
) => { maxTokens: number };

export const validateRequestMaxTokens = (maxTokens?: number): void => {
  if (maxTokens !== undefined && (!Number.isSafeInteger(maxTokens) || maxTokens <= 0))
    throw new Error("Request maxTokens must be a positive safe integer");
};

/** Reserve desired capacity before the adapter can reduce it to fit the remaining window. */
export const resolveOutputBudget = (
  model: Model<Api>,
  options: SimpleStreamOptions | undefined,
  adjustThinking: AdjustThinking,
): number => {
  validateRequestMaxTokens(options?.maxTokens);
  const requested = Math.min(options?.maxTokens ?? model.maxTokens, model.maxTokens);
  const compat = model.compat;
  let reserved = requested;
  switch (model.api) {
    case "anthropic-messages":
      if (
        options?.reasoning &&
        !(compat && "forceAdaptiveThinking" in compat && compat.forceAdaptiveThinking === true)
      ) {
        reserved = adjustThinking(
          requested,
          model.maxTokens,
          options.reasoning,
          options.thinkingBudgets,
        ).maxTokens;
      }
      return reserved;
    case "openai-responses":
    case "azure-openai-responses":
      if (compat && "supportsMaxOutputTokens" in compat && compat.supportsMaxOutputTokens === false)
        return model.maxTokens;
      reserved = Math.max(16, requested);
      break;
    case "openai-completions":
      break;
    default:
      return model.maxTokens;
  }

  // OpenAI-compatible sampling parameters are merged after the named request fields.
  const sampling = { ...model.samplingParams, ...options?.samplingParams };
  for (const field of ["max_tokens", "max_completion_tokens", "max_output_tokens"]) {
    if (sampling[field] === undefined) continue;
    const value = sampling[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
      throw new Error("Output token override must be a positive safe integer");
    reserved = Math.max(reserved, value);
  }
  if (reserved > model.maxTokens) throw new Error("Output token limit exceeds model maxTokens");
  return reserved;
};

/** Inspect only token limits after the caller's payload hook, without retaining request bodies. */
export const withOutputBudget = (
  options: SimpleStreamOptions | undefined,
  budget: ContextBudget,
  onBudget?: (budget: ContextBudget) => void,
): SimpleStreamOptions => ({
  ...options,
  maxTokens: Math.min(
    options?.maxTokens ?? budget.reservedOutputTokens,
    budget.reservedOutputTokens,
  ),
  onPayload: async (payload, model) => {
    options?.signal?.throwIfAborted();
    const replacement = await options?.onPayload?.(payload, model);
    options?.signal?.throwIfAborted();
    const finalPayload = replacement === undefined ? payload : replacement;
    if (finalPayload && typeof finalPayload === "object") {
      const values = ["max_tokens", "max_completion_tokens", "max_output_tokens"]
        .filter((field) => Object.hasOwn(finalPayload, field))
        .map((field) => (finalPayload as Record<string, unknown>)[field]);
      for (const value of values) {
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
          throw new Error("Provider output token limit must be a positive safe integer");
        if (value > budget.reservedOutputTokens)
          throw new Error("Provider output token limit exceeds the reserved output budget");
      }
      if (values.length) {
        onBudget?.({
          ...structuredClone(budget),
          requestOutputTokenLimit: Math.max(...(values as number[])),
        });
      } else if (budget.reservedOutputTokens < model.maxTokens) {
        throw new Error("Provider payload omitted the reserved output token limit");
      }
    } else if (budget.reservedOutputTokens < model.maxTokens) {
      throw new Error("Provider payload omitted the reserved output token limit");
    }
    return replacement;
  },
});
