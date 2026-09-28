import { expect, test } from "bun:test";
import {
  createModels,
  createProvider,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";

import { createModelRuntime, createProviderRuntime, getModelEfforts } from "./model-runtime";

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
    provider: "example-gateway",
    modelId: "gpt-5.5",
    baseUrl: "http://localhost:8080/api/openai/v1",
    apiKey: "test-only",
  });
  const model = runtime.getModel("example-gateway", "gpt-5.5")!;

  expect(model).toMatchObject({
    api: "openai-completions",
    reasoning: true,
    input: ["text", "image"],
  });
  expect(getModelEfforts(model)).toEqual(["default", "off", "low", "medium", "high", "xhigh"]);
  await runtime.checkModel(model);
});

test("provider registries isolate keys and preserve builtin model-specific endpoints", async () => {
  const { createProviderRuntime, getProviderCatalog } = await import("./model-runtime");
  const { builtinModels } = await import("@earendil-works/pi-ai/providers/all");
  const catalog = builtinModels();
  for (const entry of getProviderCatalog()) {
    const runtime = createProviderRuntime({
      ...entry,
      kind: "builtin",
      authentication: "apiKey",
      apiKey: "test-only",
    });
    for (const model of runtime.getModels()) {
      const original = catalog.getModel(entry.id, model.id)!;
      expect(model.baseUrl).toBe(original.baseUrl);
      expect(model.api).toBe(original.api);
    }
  }
  const config = {
    id: "example",
    kind: "custom" as const,
    name: "Example",
    baseUrl: "http://localhost:8080/v1",
    api: "openai-completions",
    models: [{ id: "one", contextWindow: 1000 }],
    authentication: "none" as const,
  };
  const runtime = createProviderRuntime(config);
  expect(runtime.getModel("example", "one")?.maxTokens).toBe(1000);
  expect(runtime.getModel("openai", "one")).toBeUndefined();
});

test("custom protocols use native Pi streams with isolated endpoint credentials", async () => {
  const { createProviderRuntime } = await import("./model-runtime");
  const requests: { path: string; key: string | null; model: string }[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();
      const path = new URL(request.url).pathname;
      requests.push({
        path,
        key: request.headers.get("authorization") ?? request.headers.get("x-api-key"),
        model: body.model,
      });
      const events = path.endsWith("/responses")
        ? [
            {
              type: "response.created",
              response: {
                id: "test-response",
                object: "response",
                status: "in_progress",
                output: [],
              },
            },
            {
              type: "response.output_item.added",
              output_index: 0,
              item: { id: "test-message", type: "message", role: "assistant", content: [] },
            },
            {
              type: "response.content_part.added",
              item_id: "test-message",
              output_index: 0,
              content_index: 0,
              part: { type: "output_text", text: "", annotations: [] },
            },
            {
              type: "response.output_text.delta",
              item_id: "test-message",
              output_index: 0,
              content_index: 0,
              delta: "OK",
            },
            {
              type: "response.output_item.done",
              output_index: 0,
              item: {
                id: "test-message",
                type: "message",
                role: "assistant",
                content: [{ type: "output_text", text: "OK", annotations: [] }],
              },
            },
            {
              type: "response.completed",
              response: {
                id: "test-response",
                status: "completed",
                usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
              },
            },
          ]
        : [
            {
              type: "message_start",
              message: {
                id: "test-message",
                type: "message",
                role: "assistant",
                model: body.model,
                content: [],
                usage: { input_tokens: 1, output_tokens: 0 },
              },
            },
            { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "OK" } },
            { type: "content_block_stop", index: 0 },
            {
              type: "message_delta",
              delta: { stop_reason: "end_turn", stop_sequence: null },
              usage: { output_tokens: 1 },
            },
            { type: "message_stop" },
          ];
      return new Response(
        events
          .map((event) => "event: " + event.type + "\ndata: " + JSON.stringify(event) + "\n\n")
          .join(""),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  try {
    for (const [id, api] of [
      ["responses", "openai-responses"],
      ["anthropic", "anthropic-messages"],
    ] as const) {
      const runtime = createProviderRuntime({
        id,
        kind: "custom",
        name: id,
        api,
        baseUrl: new URL("/" + id + "/v1", server.url).href,
        authentication: "apiKey",
        apiKey: id + "-test-key",
        models: [{ id: "same-model" }],
      });
      const model = runtime.getModel(id, "same-model")!;
      await runtime.checkModel(model);
      const stream = await runtime.streamSimple(model, {
        messages: [{ role: "user", content: "test", timestamp: 1 }],
      });
      const events: string[] = [];
      for await (const event of stream) events.push(event.type);
      const result = await stream.result();
      expect(result.stopReason).toBe("stop");
      expect(result.content).toContainEqual({
        type: "text",
        text: "OK",
        ...(result.content[0]?.type === "text" && result.content[0].textSignature
          ? { textSignature: result.content[0].textSignature }
          : {}),
      });
      expect(events).toContain("text_delta");
      expect(events.at(-1)).toBe("done");
    }
    expect(requests).toEqual([
      { path: "/responses/v1/responses", key: "Bearer responses-test-key", model: "same-model" },
      { path: "/anthropic/v1/messages", key: "anthropic-test-key", model: "same-model" },
    ]);
  } finally {
    await server.stop(true);
  }
});

test("custom openai identity keeps its gateway and sends extended effort levels without clamping", async () => {
  const { createProviderRuntime } = await import("./model-runtime");
  const requests: { path: string; auth: string | null; model: string; effort?: string }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = await request.json();
      requests.push({
        path: new URL(request.url).pathname,
        auth: request.headers.get("authorization"),
        model: body.model,
        effort: body.reasoning_effort,
      });
      return new Response(
        'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"OK"},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  try {
    const runtime = createProviderRuntime({
      id: "openai",
      name: "Gateway",
      kind: "custom",
      baseUrl: new URL("/gateway/v1", server.url).href,
      api: "openai-completions",
      authentication: "none",
      models: [{ id: "gpt-5.5", name: "GPT-5.5" }, { id: "gpt-6-astra" }],
    });
    expect(runtime.getModels().map((model) => model.id)).toEqual(["gpt-5.5", "gpt-6-astra"]);
    const model = runtime.getModel("openai", "gpt-5.5")!;
    expect(model.api).toBe("openai-completions");
    await runtime.checkModel(model);
    const stream = await runtime.streamSimple(model, {
      messages: [{ role: "user", content: "Test", timestamp: 1 }],
    });
    expect((await stream.result()).stopReason).toBe("stop");
    for (const [id, reasoning] of [
      ["gpt-5.5", "xhigh"],
      ["gpt-6-astra", "max"],
    ] as const) {
      const extended = await runtime.streamSimple(
        runtime.getModel("openai", id)!,
        {
          messages: [{ role: "user", content: "Test", timestamp: 1 }],
        },
        { reasoning },
      );
      expect((await extended.result()).stopReason).toBe("stop");
    }
    expect(requests).toEqual([
      {
        path: "/gateway/v1/chat/completions",
        auth: "Bearer local-placeholder",
        model: "gpt-5.5",
        effort: undefined,
      },
      {
        path: "/gateway/v1/chat/completions",
        auth: "Bearer local-placeholder",
        model: "gpt-5.5",
        effort: "xhigh",
      },
      {
        path: "/gateway/v1/chat/completions",
        auth: "Bearer local-placeholder",
        model: "gpt-6-astra",
        effort: "max",
      },
    ]);
  } finally {
    await server.stop(true);
  }
});

test("custom provider efforts inherit exact catalog mappings while preserving custom configuration", () => {
  const config = {
    id: "openai",
    kind: "custom" as const,
    name: "Gateway",
    baseUrl: "https://example.com/v1",
    api: "openai-responses",
    authentication: "none" as const,
    models: [
      { id: "gpt-5.5", name: "Renamed", contextWindow: 8192, maxTokens: 2048 },
      { id: "gpt-6-astra" },
      { id: "unknown-model" },
    ],
  };
  const runtime = createProviderRuntime(config);
  const model = runtime.getModel("openai", "gpt-5.5")!;
  expect(model).toMatchObject({
    name: "Renamed",
    baseUrl: config.baseUrl,
    api: config.api,
    contextWindow: 8192,
    maxTokens: 2048,
    input: ["text", "image"],
  });
  expect(getModelEfforts(model)).toEqual(["default", "off", "low", "medium", "high", "xhigh"]);
  expect(getModelEfforts(runtime.getModel("openai", "gpt-6-astra")!)).toEqual([
    "default",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ]);
  const standard: ReturnType<typeof getModelEfforts> = [
    "default",
    "off",
    "minimal",
    "low",
    "medium",
    "high",
  ];
  expect(getModelEfforts(runtime.getModel("openai", "unknown-model")!)).toEqual(standard);
  const unrelated = createProviderRuntime({ ...config, id: "example-gateway" });
  expect(getModelEfforts(unrelated.getModel("example-gateway", "gpt-5.5")!)).toEqual(standard);
  const disabled = createProviderRuntime({
    ...config,
    models: [{ id: "gpt-5.5", reasoning: false }],
  });
  expect(getModelEfforts(disabled.getModel("openai", "gpt-5.5")!)).toEqual([]);
  const anthropic = createProviderRuntime({
    ...config,
    id: "anthropic",
    api: "anthropic-messages",
    models: [{ id: "claude-opus-4-6" }],
  });
  expect(getModelEfforts(anthropic.getModel("anthropic", "claude-opus-4-6")!)).toContain("max");
  model.thinkingLevelMap!.xhigh = null;
  expect(getModelEfforts(createProviderRuntime(config).getModel("openai", "gpt-5.5")!)).toContain(
    "xhigh",
  );
});

test("effort choices follow native model capabilities rather than a fixed UI list", async () => {
  const { getModelEfforts } = await import("./model-runtime");
  const runtime = createModelRuntime({ baseUrl: "" });
  const model = runtime.getModel("openai", "gpt-5.5")!;
  expect(getModelEfforts(model)).toContain("high");
  expect(getModelEfforts({ ...model, reasoning: false })).toEqual([]);
  expect(
    getModelEfforts({
      ...model,
      thinkingLevelMap: { off: null, minimal: null, xhigh: "xhigh", max: null },
    }),
  ).toEqual(["default", "low", "medium", "high", "xhigh"]);
});
