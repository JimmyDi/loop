import { expect, test } from "vitest";
import type { Model } from "@earendil-works/pi-ai";

import type { SessionOptions } from "../types/session";
import { SessionManager } from "../session-manager";
import { prepareSessionInput } from "./session-input";

const model: Model<"openai-completions"> = {
  id: "fixture",
  name: "Fixture",
  api: "openai-completions",
  provider: "fixture",
  baseUrl: "https://example.invalid",
  input: ["text"],
  reasoning: false,
  contextWindow: 32000,
  maxTokens: 1024,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

test("input preparation snapshots changed capabilities without mutating retained checkpoints", async () => {
  const options: SessionOptions = {
    model,
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Fixture",
    tools: [],
    modelRuntime: {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => {
        throw new Error("Preparation must not call a model");
      },
    },
  };
  const common = {
    options,
    model,
    runtimeContexts: [],
    systemPromptCheckpoints: [],
    input: "first",
    skills: [],
    messages: [],
    signal: new AbortController().signal,
  };
  const first = await prepareSessionInput(common);
  options.tools.push({
    name: "fixture",
    description: "Fixture",
    parameters: { type: "object" },
    execute: () => [],
    displayName: "Readable fixture",
  } as SessionOptions["tools"][number]);
  const second = await prepareSessionInput({
    ...common,
    messages: [{ role: "user", content: "first", timestamp: 1 }],
    systemPromptCheckpoints: first.systemPromptCheckpoints,
  });
  expect(first.tools).toEqual([]);
  expect(first.systemPromptCheckpoints).toHaveLength(1);
  expect(second.tools.map((tool) => tool.name)).toEqual(["fixture"]);
  expect(second.toolDisplayNames.get("fixture")).toBe("Readable fixture");
  expect(second.systemPromptCheckpoints.at(-1)?.messageCount).toBe(2);
  expect(second.userTurn).toBe(1);
  expect(common.systemPromptCheckpoints).toEqual([]);
});
