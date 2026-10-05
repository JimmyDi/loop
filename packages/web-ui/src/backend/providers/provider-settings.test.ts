import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { expect, test } from "vitest";

import { AgentSession, SessionManager } from "@loop/coding-agent";
import { ProviderSettings } from "./provider-settings";

test("first use exposes no implicit models before provider setup", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-test-"));
  try {
    const settings = new ProviderSettings(join(root, "provider.json"));
    expect((await settings.view()).providers).toEqual([]);
    expect(await settings.models()).toEqual([]);
    expect(settings.defaultModel()).toBeUndefined();
    const runtime = await settings.runtime();
    expect(runtime.getModels()).toEqual([]);
    expect(runtime.getModel("openai", "gpt-5.5")).toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("saved settings drive model API requests and existing session runtimes pick up endpoint/key changes", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-test-"));
  const requests: { path: string; authorization: string | null }[] = [];
  const server = await serveTest({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = await request.json();

      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
      });
      expect(body.model).toBe("gpt-5.5");

      return new Response(
        [
          {
            choices: [
              { index: 0, delta: { role: "assistant", content: "OK" }, finish_reason: null },
            ],
          },
          { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
        ]
          .map((chunk) => "data: " + JSON.stringify(chunk) + "\n\n")
          .join("") + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });

  try {
    const settings = new ProviderSettings(join(root, "provider.json"));
    const input = {
      name: "Gateway",
      baseUrl: new URL("v1", server.url).href,
      id: "gateway",
      kind: "custom" as const,
      api: "openai-completions",
      models: [{ id: "gpt-5.5" }],
      authentication: "apiKey" as const,
      apiKey: "first-key",
    };

    await settings.upsert(input, true);
    const runtime = await settings.runtime();
    const session = new AgentSession({
      model: settings.defaultModel()!,
      modelRuntime: runtime,
      sessionManager: SessionManager.inMemory(root),
      systemPrompt: "Test",
      tools: [],
    });

    await session.prompt("hello");
    await settings.upsert(
      {
        ...input,
        baseUrl: new URL("updated", server.url).href,
        apiKey: "second-key",
      },
      false,
    );
    await session.prompt("again");
    expect(requests).toEqual([
      { path: "/v1/chat/completions", authorization: "Bearer first-key" },
      { path: "/updated/chat/completions", authorization: "Bearer second-key" },
    ]);
    expect(session.state.messages).toHaveLength(4);
    expect(session.state.outcome).toBe("success");
    await settings.upsert({ ...input, authentication: "none", apiKey: undefined }, false);
    await session.prompt("without a key");
    expect(requests.at(-1)).toEqual({
      path: "/v1/chat/completions",
      authorization: "Bearer local-placeholder",
    });
    await settings.upsert({ ...input, models: [{ id: "different-model" }] }, false);
    await expect(session.prompt("old model")).rejects.toThrow("Model not found");
    expect(requests).toHaveLength(3);
    session.dispose();
    const restored = new ProviderSettings(join(root, "provider.json"));

    await restored.runtime();
    expect(restored.defaultModel()?.baseUrl).toBe(input.baseUrl);
    expect(restored.defaultModel()?.id).toBe("different-model");
    expect(restored.defaultModel()?.api).toBe("openai-completions");
  } finally {
    await server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("saved custom models expose catalog efforts and restore an extended effort without new provider fields", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-test-"));
  const file = join(root, "provider.json");
  try {
    const settings = new ProviderSettings(file);
    await settings.upsert(
      {
        id: "openai",
        kind: "custom",
        name: "Gateway",
        baseUrl: "https://example.com/v1",
        api: "openai-responses",
        authentication: "none",
        models: [{ id: "gpt-5.5" }, { id: "gpt-6-astra" }],
      },
      true,
    );
    const restored = new ProviderSettings(file);
    const choices = await restored.models();
    expect(choices.find((model) => model.id === "gpt-5.5")?.efforts).toEqual([
      "default",
      "off",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(choices.find((model) => model.id === "gpt-6-astra")?.efforts).toContain("max");
    const runtime = await restored.runtime();
    const manager = SessionManager.inMemory(root);
    const options = {
      modelRuntime: runtime,
      sessionManager: manager,
      systemPrompt: "Test",
      tools: [],
    };
    const session = new AgentSession({ ...options, model: runtime.getModel("openai", "gpt-5.5")! });
    await session.setModel(session.model, { effort: "xhigh" });
    expect(session.effort).toBe("xhigh");
    await expect(session.setModel(session.model, { effort: "max" })).rejects.toThrow(
      "Unsupported model effort",
    );
    const model = runtime.getModel("openai", "gpt-6-astra")!;
    await session.setModel(model, { effort: "max" });
    session.dispose();
    const reopened = new AgentSession({ ...options, model });
    expect(reopened.effort).toBe("max");
    reopened.dispose();
    await restored.selectModel({ provider: "openai", id: model.id, effort: "max" });
    const reloaded = new ProviderSettings(file);
    await reloaded.models();
    expect(reloaded.defaultEffort()).toBe("max");
    expect(await readFile(file, "utf8")).not.toContain("thinkingLevelMap");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removing models persists metadata and an empty provider without restoring catalog defaults", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".provider-test-"));
  const file = join(root, "provider.json");
  const config = {
    id: "loop-custom",
    kind: "custom" as const,
    name: "Gateway",
    baseUrl: "https://example.com/v1",
    api: "openai-completions",
    authentication: "none" as const,
    models: [
      { id: "first", name: "First", contextWindow: 8192, maxTokens: 2048 },
      { id: "removed" },
    ],
  };
  try {
    const settings = new ProviderSettings(file);
    await settings.upsert(config, true);
    await settings.selectModel({ provider: config.id, id: "removed" });
    await settings.upsert({ ...config, models: [config.models[0]!] }, false);
    const restored = new ProviderSettings(file);
    const runtime = await restored.runtime();
    expect((await restored.models()).map((model) => model.id)).toEqual(["first"]);
    expect(runtime.getModel(config.id, "first")).toMatchObject({
      name: "First",
      contextWindow: 8192,
      maxTokens: 2048,
    });
    expect(runtime.getModel(config.id, "removed")).toBeUndefined();
    await restored.upsert({ ...config, models: [] }, false);
    await restored.upsert({ ...config, id: "second", models: [{ id: "available" }] }, true);
    expect(restored.defaultModel()?.id).toBe("available");
    await restored.remove("second");
    const empty = new ProviderSettings(file);
    expect(await empty.models()).toEqual([]);
    expect(empty.defaultModel()).toBeUndefined();
    expect((await empty.view()).providers[0]?.models).toEqual([]);
    expect((await empty.runtime()).getModels()).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const serveTest = async (options: {
  hostname: string;
  port: number;
  fetch(request: Request): Response | Promise<Response>;
}) => {
  const server = createServer(getRequestListener(options.fetch));
  server.listen(options.port, options.hostname);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    url: new URL("http://127.0.0.1:" + address.port + "/"),
    stop: async (_force?: boolean) =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};
