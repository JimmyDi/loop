import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { AgentSession, SessionManager } from "../../../coding-agent/index";
import { ProviderSettings } from "./provider-settings";

test("saved settings drive real Pi requests and existing session runtimes pick up endpoint/key changes", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".provider-test-"));
  const requests: { path: string; authorization: string | null }[] = [];
  const server = Bun.serve({
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
      modelId: "gpt-5.5",
      authentication: "apiKey" as const,
      apiKey: "first-key",
    };

    await settings.save(input);
    const runtime = await settings.runtime();
    const session = new AgentSession({
      model: settings.defaultModel()!,
      modelRuntime: runtime,
      sessionManager: SessionManager.inMemory(root),
      systemPrompt: "Test",
      tools: [],
    });

    await session.prompt("hello");
    await settings.save({
      ...input,
      baseUrl: new URL("updated", server.url).href,
      apiKey: "second-key",
    });
    await session.prompt("again");
    expect(requests).toEqual([
      { path: "/v1/chat/completions", authorization: "Bearer first-key" },
      { path: "/updated/chat/completions", authorization: "Bearer second-key" },
    ]);
    expect(session.state.messages).toHaveLength(4);
    expect(session.state.outcome).toBe("success");
    await settings.save({ ...input, authentication: "none", apiKey: undefined });
    await session.prompt("without a key");
    expect(requests.at(-1)).toEqual({
      path: "/v1/chat/completions",
      authorization: "Bearer local-placeholder",
    });
    await settings.save({ ...input, modelId: "different-model" });
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
