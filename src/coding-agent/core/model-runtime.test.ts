import { expect, test } from "bun:test";
import {
  createModels,
  createProvider,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";

import { createModelRuntime } from "./model-runtime";

test("host Pi AI registry handles auth and requests without environment credentials", async () => {
  const model: Model<"openai-completions"> = {
    id: "test",
    name: "test",
    provider: "test-provider",
    api: "openai-completions",
    baseUrl: "https://example.invalid",
    input: ["text"],
    reasoning: false,
    contextWindow: 4096,
    maxTokens: 128,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  let authenticated = false;
  let requests = 0;
  const models = createModels({
    authContext: { env: async () => undefined, fileExists: async () => false },
  });
  const response = createAssistantMessageEventStream();
  const message: AssistantMessage = {
    role: "assistant",
    content: [{ type: "text", text: "ok" }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    timestamp: 1,
    stopReason: "stop",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };

  response.push({ type: "done", reason: "stop", message });

  const request = () => {
    requests++;
    return response;
  };

  models.setProvider(
    createProvider({
      id: model.provider,
      models: [model],
      auth: {
        apiKey: {
          name: "Test",
          resolve: async () => (authenticated ? { auth: { apiKey: "test-only" } } : undefined),
        },
      },
      api: { stream: request, streamSimple: request },
    }),
  );

  const runtime = createModelRuntime({ models, provider: model.provider });

  await expect(runtime.checkModel(model)).rejects.toThrow("authentication");
  expect(requests).toBe(0);
  authenticated = true;
  await runtime.checkModel(model);

  const stream = await runtime.streamSimple(model, { messages: [] });

  expect(await stream.result()).toEqual(message);
  expect(requests).toBe(1);
  expect(runtime.getModel(model.provider, model.id)).toEqual(model);
  expect(runtime.getModel(model.provider, "missing")).toBeUndefined();
});

test("default OpenAI model keeps Responses unless a custom gateway is configured", () => {
  const native = createModelRuntime({ provider: "openai", modelId: "gpt-5.5", baseUrl: "" });
  const gateway = createModelRuntime({
    provider: "openai",
    modelId: "gpt-5.5",
    baseUrl: "http://localhost:8080/api/openai/v1",
    apiKey: "test-only",
  });

  expect(native.getModel("openai", "gpt-5.5")).toMatchObject({
    api: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
  });
  expect(gateway.getModel("openai", "gpt-5.5")).toMatchObject({
    api: "openai-completions",
    baseUrl: "http://localhost:8080/api/openai/v1",
    reasoning: true,
    maxTokens: 4096,
  });
  expect(gateway.getModels().filter((model) => model.provider === "openai").length).toBe(
    native.getModels().filter((model) => model.provider === "openai").length,
  );
});

test("custom named gateways reuse catalog capabilities for known OpenAI models", async () => {
  const runtime = createModelRuntime({
    provider: "agent-maestro",
    modelId: "gpt-5.5",
    baseUrl: "http://localhost:8080/api/openai/v1",
    apiKey: "test-only",
  });
  const model = runtime.getModel("agent-maestro", "gpt-5.5")!;

  expect(model).toMatchObject({
    api: "openai-completions",
    reasoning: true,
    input: ["text", "image"],
  });
  await runtime.checkModel(model);
});
