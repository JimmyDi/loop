import type { Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { validateLoopInput } from "./validate-loop-input";
import type { AgentLoopOptions, PromptContent } from "./types";

const model: Model<"openai-completions"> = {
  id: "test",
  name: "Test",
  provider: "test",
  api: "openai-completions",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: false,
  contextWindow: 4096,
  maxTokens: 512,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const options: AgentLoopOptions = {
  model,
  streamFn: () => {
    throw new Error("Validation must not request a model");
  },
};

test("rejects empty and malformed untyped input and rejects images on text-only models", () => {
  for (const content of ["", "  ", [], null, [{ type: "text", text: " " }]]) {
    expect(() => validateLoopInput(content as PromptContent, options)).toThrow(
      "Prompt is required",
    );
  }
  for (const content of [
    [null],
    [{ type: "text", text: 1 }],
    [{ type: "image", data: "", mimeType: "image/png" }],
  ]) {
    expect(() => validateLoopInput(content as PromptContent, options)).toThrow(
      "Invalid prompt content",
    );
  }
  const image = [{ type: "image" as const, data: "AAAA", mimeType: "image/png" }];
  expect(() => validateLoopInput(image, options)).toThrow("does not support image");
  expect(() =>
    validateLoopInput(image, { ...options, model: { ...model, input: ["text", "image"] } }),
  ).not.toThrow();
});

test("requires an explicit stream function and a positive integer turn limit", () => {
  expect(() =>
    validateLoopInput("hello", { ...options, streamFn: undefined } as unknown as AgentLoopOptions),
  ).toThrow("streamFn is required");
  for (const maxTurns of [0, -1, 1.5, Infinity, NaN]) {
    expect(() => validateLoopInput("hello", { ...options, maxTurns })).toThrow("positive integer");
  }
  expect(() => validateLoopInput("hello", { ...options, maxTurns: 1 })).not.toThrow();
});
