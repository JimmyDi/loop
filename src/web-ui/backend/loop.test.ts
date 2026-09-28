import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { SessionManager, getSessionDir } from "../../coding-agent/index";
import { createLoopBridge } from "./loop";

test("SDK bridge lists canonical project history without exposing file paths", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".bridge-test-"));

  try {
    const manager = await SessionManager.create(root, getSessionDir(root, root));
    const bridge = createLoopBridge(root);
    const sessions = await bridge.list({ id: "project", name: "Example", cwd: root });

    expect(sessions[0]?.id).toBe(manager.getSessionId());
    expect(sessions[0]?.workspaceId).toBe("project");
    expect(sessions[0]).not.toHaveProperty("path");
    await manager.commit([{ role: "user", content: "First historical request", timestamp: 0 }]);
    expect((await bridge.list({ id: "project", name: "Example", cwd: root }))[0]?.title).toBe(
      "First historical request",
    );
    await expect(
      bridge.load({ id: "project", name: "Example", cwd: root }, "unknown"),
    ).rejects.toThrow("Session not found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provider deletion keeps saved conversations readable and requires explicit model recovery", async () => {
  const { ProviderSettings } = await import("./providers/provider-settings");
  const root = await mkdtemp(join(import.meta.dir, ".bridge-test-"));
  const settings = new ProviderSettings(join(root, "provider.json"));
  const config = {
    id: "example",
    kind: "custom" as const,
    name: "Example",
    api: "openai-completions",
    baseUrl: "http://localhost:8080/v1",
    authentication: "none" as const,
    models: [{ id: "first" }, { id: "second" }],
  };
  const project = { id: "project", name: "Example", cwd: root };
  try {
    await settings.upsert(config, true);
    const bridge = createLoopBridge(root, settings);
    const session = await bridge.load(project);
    await bridge.setModel(session, { provider: config.id, id: "second" });
    const next = await bridge.load(project);
    expect(next.model.id).toBe("second");
    const restoredSettings = new ProviderSettings(join(root, "provider.json"));
    await restoredSettings.runtime();
    expect(restoredSettings.defaultModel()?.id).toBe("second");
    const sessionId = session.sessionId;
    expect(await SessionManager.list(root, getSessionDir(root, root))).toEqual([]);
    const manager = (session as import("../../coding-agent/index").AgentSession).sessionManager;
    await manager.commit([{ role: "user", content: "Saved example message", timestamp: 1 }]);
    session.dispose();
    next.dispose();
    const record = (await SessionManager.list(root, getSessionDir(root, root))).find(
      (entry) => entry.id === sessionId,
    )!;
    expect((await SessionManager.open(record.path)).messages).toHaveLength(1);
    await settings.remove(config.id);
    const afterRestart = new ProviderSettings(join(root, "provider.json"));
    const restarted = createLoopBridge(root, afterRestart);
    expect(await restarted.models()).toEqual([]);
    const restored = await restarted.load(project, sessionId);
    expect(restored.state.title).toMatchObject({
      text: "Saved example message",
      source: "fallback",
    });
    expect(restored.model).toMatchObject({ provider: config.id, id: "second" });
    await expect(restored.prompt("must not call a service")).rejects.toThrow("Model not found");
    expect(restored.state.messages).toEqual([
      { role: "user", content: "Saved example message", timestamp: 1 },
    ]);
    await afterRestart.upsert({ ...config, id: "replacement" }, true);
    await restarted.setModel(restored, { provider: "replacement", id: "first" });
    expect(restored.model.provider).toBe("replacement");
    restored.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("model API lists only saved providers with display names through edits and deletion", async () => {
  const { ProviderSettings } = await import("./providers/provider-settings");
  const { SessionRegistry } = await import("./session-registry");
  const { ProjectStore } = await import("./projects/project-store");
  const { createRouter } = await import("./router");
  const root = await mkdtemp(join(import.meta.dir, ".model-menu-test-"));
  const file = join(root, "provider.json");
  const settings = new ProviderSettings(file);
  const bridge = createLoopBridge(root, settings);
  const registry = new SessionRegistry(new ProjectStore(join(root, "projects.json")), bridge);
  const router = createRouter(registry, settings);
  const list = async () => {
    const response = await router(new Request("http://localhost/api/models"));
    expect(response.status).toBe(200);
    return response.json();
  };
  const config = {
    id: "example",
    kind: "custom" as const,
    name: "Example Gateway",
    baseUrl: "http://localhost:8080/v1",
    api: "openai-completions",
    authentication: "none" as const,
    models: [{ id: "chosen", name: "Chosen Model" }],
  };
  try {
    expect(await list()).toEqual([]);
    expect(await Bun.file(file).exists()).toBe(false);
    await settings.upsert(config, true);
    expect(await list()).toEqual([
      {
        provider: "example",
        providerName: "Example Gateway",
        id: "chosen",
        name: "Chosen Model",
        efforts: ["default", "off", "minimal", "low", "medium", "high"],
        input: ["text", "image"],
      },
    ]);
    const project = await registry.projects.add(root);
    const session = (await registry.create(project.id)).session;
    const original = session.model;
    await expect(bridge.setModel(session, { provider: "openai", id: "gpt-4" })).rejects.toThrow(
      "Model not found",
    );
    expect(session.model).toEqual(original);
    await settings.upsert({ ...config, name: "Renamed Gateway" }, false);
    expect((await list())[0].providerName).toBe("Renamed Gateway");
    await settings.upsert(
      { ...config, id: "openai", kind: "builtin", authentication: "apiKey", apiKey: "test-key" },
      true,
    );
    const configured = await list();
    expect(
      new Set(configured.map((model: { providerName: string }) => model.providerName)),
    ).toEqual(new Set(["Renamed Gateway", "OpenAI"]));
    expect(JSON.stringify(configured)).not.toContain("test-key");
    expect(JSON.stringify(configured)).not.toContain("baseUrl");
    expect(await createLoopBridge(root, new ProviderSettings(file)).models()).toEqual(configured);
    await settings.remove("openai");
    expect(await list()).toHaveLength(1);
    await settings.remove(config.id);
    expect(await list()).toEqual([]);
    expect(await createLoopBridge(root, new ProviderSettings(file)).models()).toEqual([]);
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Web effort reaches Pi request, survives reload and becomes the new-session default", async () => {
  const { ProviderSettings } = await import("./providers/provider-settings");
  const { SessionRegistry } = await import("./session-registry");
  const { ProjectStore } = await import("./projects/project-store");
  const { createRouter } = await import("./router");
  const root = await mkdtemp(join(import.meta.dir, ".effort-test-"));
  const requests: unknown[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      requests.push(await request.json());
      return new Response(
        'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"OK"},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  const settings = new ProviderSettings(join(root, "provider.json"));
  const registry = new SessionRegistry(
    new ProjectStore(join(root, "projects.json")),
    createLoopBridge(root, settings),
  );
  try {
    await settings.upsert(
      {
        id: "example",
        kind: "custom",
        name: "Example",
        api: "openai-completions",
        baseUrl: new URL("v1", server.url).href,
        models: [{ id: "reasoner", reasoning: false, input: ["text"] }, { id: "plain" }],
        authentication: "none",
      },
      true,
    );
    const project = await registry.projects.add(root);
    const controller = await registry.create(project.id);
    const router = createRouter(registry, settings);
    const change = (effort: string, id = "reasoner") =>
      router(
        new Request("http://localhost/api/sessions/" + controller.session.sessionId + "/model", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "example", id, effort }),
        }),
      );
    expect((await change("unknown")).status).toBe(400);
    expect((await change("xhigh", "plain")).status).toBe(400);
    const response = await change("high");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      effort: "high",
      model: { efforts: ["default", "off", "minimal", "low", "medium", "high"] },
    });
    expect(requests).toEqual([]);
    const image = {
      type: "image",
      mimeType: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG9kAAAAASUVORK5CYII=",
    };
    const prompt = (images: unknown) =>
      router(
        new Request("http://localhost/api/sessions/" + controller.session.sessionId + "/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: "image-request", text: "", images }),
        }),
      );
    expect((await prompt([{ ...image, mimeType: "image/svg+xml" }])).status).toBe(400);
    expect(requests).toEqual([]);
    const accepted = await prompt([image]);
    expect(accepted.status).toBe(202);
    expect(await (await prompt([image])).json()).toEqual(await accepted.json());
    expect((await prompt([{ ...image, data: "AAAA" }])).status).toBe(409);
    for (let tries = 0; tries < 100 && controller.busy; tries++) await Bun.sleep(5);
    expect(controller.busy).toBe(false);
    expect(controller.session.state.outcome).toBe("success");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ reasoning_effort: "high" });
    expect(JSON.stringify(requests[0])).toContain("data:image/png;base64," + image.data);
    const next = await registry.create(project.id);
    expect(next.session.effort).toBe("high");
    const fresh = createLoopBridge(root, new ProviderSettings(join(root, "provider.json")));
    const restored = await fresh.load(project, controller.session.sessionId);
    expect(restored.effort).toBe("high");
    expect(restored.state.messages).toHaveLength(2);
    expect(restored.state.messages[0]).toMatchObject({ role: "user", content: [image] });
    restored.dispose();
    expect((await change("default", "plain")).status).toBe(200);
    expect(controller.snapshot.model.efforts).toContain("high");
    await controller.session.prompt("default request");
    expect(requests.at(-1)).not.toHaveProperty("reasoning_effort");
  } finally {
    await registry.close();
    await server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
