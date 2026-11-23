import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { createModelRuntime } from "@loop/coding-agent";
import { expect, test } from "vitest";

import { createEchoService } from "./service";
import type { ProviderSettings } from "../providers/provider-settings";

test("Echo shares native history while switching the replying Agent and isolates ordinary routes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-echo-service-"));
  const model = createModelRuntime().getModel("anthropic", "claude-opus-4-5")!;
  let calls = 0;
  const runtime = {
    getModels: () => [model],
    getModel: () => model,
    checkModel: async () => {},
    streamSimple: (
      _model: unknown,
      context: { messages: unknown[]; tools?: { name: string }[]; systemPrompt?: string },
    ) => {
      calls++;
      expect(context.tools?.map((tool) => tool.name)).toEqual([
        "request_user_input",
        "computer_operation",
        "computer_operation_status",
      ]);
      if (calls === 2) {
        expect(context.messages).toHaveLength(3);
        expect(context.systemPrompt).toContain("You are Two");
      }
      const stream = createAssistantMessageEventStream();
      const message = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Synthetic response" }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: calls,
        stopReason: "stop" as const,
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };
      stream.push({ type: "done", reason: "stop", message });
      stream.end();
      return stream;
    },
  };
  const providers = {
    models: async () => [],
    runtime: async () => runtime,
    defaultModel: () => model,
  } as unknown as ProviderSettings;
  const service = createEchoService(dir, providers);
  const call = async (path: string, body: unknown) => {
    const request = new Request("http://localhost/api/echo" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await service.route(request, new URL(request.url)))!.json();
  };
  try {
    const one = await call("/agents", { name: "One", instructions: "" });
    const two = await call("/agents", { name: "Two", instructions: "" });
    const chat = await call("/conversations", { name: "Group", agentIds: [one.id, two.id] });
    let controller = await service.registry.get(chat.id);
    expect(controller.session.state.title?.text).toBe("Group");
    controller.prompt("first", "Hello");
    while (controller.busy) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(controller.session.state.messages.at(-1)).toHaveProperty("loopAssistantLabel", "One");
    await service.registry.unload(chat.id);
    await service.store.mutate((data) => {
      data.conversations[0]!.responderId = two.id;
    });
    controller = await service.registry.get(chat.id);
    controller.prompt("second", "Continue");
    while (controller.busy) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(controller.session.state.messages[1]).toHaveProperty("loopAssistantLabel", "One");
    expect(controller.session.state.messages.at(-1)).toHaveProperty("loopAssistantLabel", "Two");
    const request = new Request("http://localhost/api/sessions/ordinary");
    expect(await service.route(request, new URL(request.url))).toBeUndefined();
    await writeFile(join(service.store.directory, "echo.json"), "malformed");
    const home = new Request("http://localhost/api/sessions/00000000-0000-0000-0000-000000000000");
    expect(await service.route(home, new URL(home.url))).toBeUndefined();
  } finally {
    await service.close();
    await rm(dir, { recursive: true, force: true });
  }
});
