import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";

import type { ModelRuntime } from "../model-runtime";
import { generateTitle } from "./generate-title";

test("title generation rejects empty text and tool calls without executing or continuing", async () => {
  const model: Model<Api> = {
    id: "example",
    name: "Example",
    provider: "example",
    api: "openai-completions",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 4096,
    maxTokens: 512,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const cases: AssistantMessage["content"][] = [
    [],
    [{ type: "text", text: "   " }],
    [{ type: "toolCall", id: "unexpected", name: "write", arguments: { path: "never.txt" } }],
  ];
  for (const content of cases) {
    let calls = 0;
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: (_model, context) => {
        calls++;
        expect(context.tools).toEqual([]);
        const stream = createAssistantMessageEventStream();
        const message: AssistantMessage = {
          role: "assistant",
          api: model.api,
          model: model.id,
          provider: model.provider,
          timestamp: 0,
          content,
          stopReason: content.some((part) => part.type === "toolCall") ? "toolUse" : "stop",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        };
        stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
        return stream;
      },
    };
    await expect(
      generateTitle(
        runtime,
        model,
        [{ index: 0, text: "Example task" }],
        {},
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  }
});
