import { expect, test } from "vitest";

import { validateProviderConfig } from "./validate-provider-config";

const input = {
  id: "gateway",
  kind: "custom",
  name: "Gateway",
  baseUrl: "https://example.com/v1/",
  api: "openai-responses",
  authentication: "apiKey",
  models: [{ id: "one", contextWindow: 2000 }],
};

test("custom configuration validates IDs, protocols, unique models and capacity", () => {
  expect(validateProviderConfig(input).baseUrl).toBe("https://example.com/v1");
  for (const patch of [
    { id: "Bad ID" },
    { api: "unknown" },
    { models: null },
    { models: [{ id: "one" }, { id: " one " }] },
    { models: [{ id: "x", contextWindow: 100, maxTokens: 101 }] },
    { models: [{ id: "x", maxTokens: 200000 }] },
    { models: [{ id: "x", input: ["text", "image"] }] },
    { models: [{ id: "x", reasoning: true }] },
    { baseUrl: "https://example.com/v1/messages" },
  ]) {
    expect(() => validateProviderConfig({ ...input, ...patch })).toThrow();
  }
  expect(validateProviderConfig({ ...input, models: [] }).models).toEqual([]);
});

test("builtins use trusted catalog endpoints and protocols", () => {
  const config = validateProviderConfig({ ...input, id: "deepseek", kind: "builtin" });
  expect(config.baseUrl).toBe("https://api.deepseek.com");
  expect(config.api).toBe("openai-completions");
  expect(config.name).toBe("DeepSeek");
  expect(config.models.length).toBeGreaterThan(0);
});

test("a custom provider can use a catalog ID without inheriting official settings or unselected models", () => {
  const config = validateProviderConfig({
    ...input,
    id: "openai",
    name: "OpenAI gateway",
    authentication: "none",
    api: "openai-completions",
  });
  expect(config).toMatchObject({
    id: "openai",
    kind: "custom",
    name: "OpenAI gateway",
    baseUrl: "https://example.com/v1",
    authentication: "none",
    api: "openai-completions",
  });
  expect(config.models.map((model) => model.id)).toEqual(["one"]);
});
