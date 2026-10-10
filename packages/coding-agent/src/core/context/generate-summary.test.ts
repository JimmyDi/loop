import { expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";

import { generateSummary } from "./generate-summary";

test("rejects oversized summary input before model dispatch without truncating it", async () => {
  const model: Model<"openai-completions"> = {
    id: "fixture",
    name: "Fixture",
    provider: "fixture",
    api: "openai-completions",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 1024,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  let calls = 0;
  const runtime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple: () => {
      calls++;
      throw new Error("Never dispatched");
    },
  };
  await expect(
    generateSummary(
      runtime,
      model,
      [{ role: "user", content: "x".repeat(20000), timestamp: 1 }],
      new AbortController().signal,
    ),
  ).rejects.toThrow("Context budget exceeded");
  expect(calls).toBe(0);
});

test("cancellation interrupts authentication that does not settle promptly", async () => {
  const model: Model<"openai-completions"> = {
    id: "fixture",
    name: "Fixture",
    provider: "fixture",
    api: "openai-completions",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 32000,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const started = Promise.withResolvers<void>();
  const blocked = Promise.withResolvers<void>();
  const controller = new AbortController();
  const runtime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: () => {
      started.resolve();
      return blocked.promise;
    },
    streamSimple: () => {
      throw new Error("Must not dispatch after abort");
    },
  };
  const pending = generateSummary(
    runtime,
    model,
    [{ role: "user", content: "Task", timestamp: 1 }],
    controller.signal,
  );
  const rejected = expect(pending).rejects.toThrow("Cancelled summary");
  await started.promise;
  controller.abort(new Error("Cancelled summary"));
  await rejected;
  blocked.resolve();
});

test("summary preflight reserves its own cap instead of the model maximum", async () => {
  const model: Model<"openai-completions"> = {
    id: "fixture",
    name: "Fixture",
    provider: "fixture",
    api: "openai-completions",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 32000,
    maxTokens: 28000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  let calls = 0;
  const result = await generateSummary(
    {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: (_model, _context, options) => {
        calls++;
        expect(options?.maxTokens).toBe(4096);
        const stream = createAssistantMessageEventStream();
        const message = {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Task checkpoint" }],
          api: model.api,
          provider: model.provider,
          model: model.id,
          timestamp: 1,
          stopReason: "stop" as const,
          usage: {
            input: 5000,
            output: 10,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 5010,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        };
        stream.push({ type: "done", reason: "stop", message });
        stream.end();
        return stream;
      },
    },
    model,
    [{ role: "user", content: "x".repeat(20000), timestamp: 0 }],
    new AbortController().signal,
  );
  expect(calls).toBe(1);
  expect(result.summary).toBe("Task checkpoint");
});
