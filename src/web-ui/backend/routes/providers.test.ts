import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { ProviderSettings } from "../providers/provider-settings";
import { ProjectStore } from "../projects/project-store";
import { createLoopBridge } from "../loop";
import { SessionRegistry } from "../session-registry";
import { createRouter } from "../router";

test("provider API saves without returning credentials and rejects updates during session activity", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".provider-test-"));
  const settings = new ProviderSettings(join(root, "provider.json"));
  const registry = new SessionRegistry(
    new ProjectStore(join(root, "projects.json")),
    createLoopBridge(root, settings),
  );
  const router = createRouter(registry, settings);
  const body = {
    name: "Gateway",
    baseUrl: "http://localhost:8080/v1",
    modelId: "gpt-5.5",
    authentication: "apiKey",
    apiKey: "test-secret",
  };
  const request = (method = "GET", origin?: string) =>
    router(
      new Request("http://localhost/api/settings/provider", {
        method,
        headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) },
        body: method === "PUT" ? JSON.stringify(body) : undefined,
      }),
    );

  try {
    expect(await (await request()).json()).toBeNull();
    expect((await request("PUT", "https://foreign.example")).status).toBe(403);
    const saved = await request("PUT");

    expect(saved.status).toBe(200);
    expect(await saved.text()).not.toContain("test-secret");
    expect(await (await request()).json()).toMatchObject({
      provider: "loop-custom",
      hasApiKey: true,
    });
    const project = await registry.projects.add(root);
    const controller = await registry.create(project.id);

    expect(controller.session.model.provider).toBe("loop-custom");
    let release!: () => void;
    const operation = controller.command(
      "model",
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    expect((await request("PUT")).status).toBe(409);
    release();
    await operation;
    let finish!: () => void;
    const configuration = registry.configure(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    await Promise.resolve();
    await expect(registry.create(project.id)).rejects.toThrow("provider_busy");
    finish();
    await configuration;
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
