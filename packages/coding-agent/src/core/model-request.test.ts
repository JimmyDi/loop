import type { Context, Model } from "@earendil-works/pi-ai";
import { expect, test } from "vitest";

import { assembleModelRequest } from "./model-request";

test("assembly counts projected host context and isolates the source history and tool schemas", () => {
  const model: Model<"openai-completions"> = {
    id: "test",
    provider: "test",
    api: "openai-completions",
    name: "Test",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 4096,
    maxTokens: 512,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const context: Context = {
    systemPrompt: "Stable project instructions",
    messages: [{ role: "user", content: "Hello", timestamp: 1 }],
    tools: [{ name: "read", description: "Read", parameters: { type: "object" } }],
  };
  const snapshots = [{ userTurn: 0, content: "Host permission context", timestamp: 2 }];
  const before = structuredClone(context);
  const plain = assembleModelRequest(model, context, []);
  const request = assembleModelRequest(model, context, snapshots);
  expect(request.context.messages.map((message) => message.content)).toEqual([
    "Hello",
    "Host permission context",
  ]);
  expect(request.budget.estimatedInputTokens).toBeGreaterThan(plain.budget.estimatedInputTokens);
  expect(request.budget.systemTokens).toBe(plain.budget.systemTokens);
  expect(request.budget.toolTokens).toBe(plain.budget.toolTokens);
  request.context.messages[0]!.content = "changed";
  request.context.tools![0]!.parameters = { type: "string" };
  expect(context).toEqual(before);
  expect(snapshots[0]?.content).toBe("Host permission context");
});
