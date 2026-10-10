import { expect, test } from "vitest";
import type { Model } from "@earendil-works/pi-ai";

import { SessionManager } from "../session-manager";
import type { SessionOptions } from "../types/session";
import { buildSessionModelContext } from "./session-model-context";

test("request and idle estimate share declarations, catalog rules and permission instructions", () => {
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
  const options: SessionOptions = {
    model,
    sessionManager: SessionManager.inMemory(),
    systemPrompt: "Project instructions",
    tools: [
      {
        name: "read",
        description: "Read fixture",
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
  const restricted = buildSessionModelContext(options, model, "read-only");
  expect(restricted.systemPrompt).toContain("Project instructions");
  expect(restricted.systemPrompt).toContain('["read"]');
  expect(restricted.systemPrompt).toContain("<permissions>");
  expect(restricted.systemPrompt).toContain("read-only");
  expect(restricted.tools).toEqual(options.tools);
  const full = buildSessionModelContext(options, model, "danger-full-access");
  expect(full.systemPrompt).toContain("danger-full-access");
  expect(full.systemPrompt).not.toBe(restricted.systemPrompt);
});
