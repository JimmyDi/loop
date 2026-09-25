import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { AgentSession, SessionManager } from "../../coding-agent/index";
import type { ModelRuntime } from "../../coding-agent/index";
import type { LoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { SessionRegistry } from "./session-registry";

test("registry shares one writable instance and guards removal against load/run races", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".registry-test-"));

  try {
    const projects = new ProjectStore(join(root, "projects.json"));
    const project = await projects.add(root);
    const model = {
      id: "test",
      name: "Test",
      provider: "test",
      api: "openai-completions" as const,
      baseUrl: "http://localhost",
      reasoning: false,
      input: ["text" as const],
      contextWindow: 4096,
      maxTokens: 128,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    };
    const manager = SessionManager.inMemory(root);
    const id = manager.getSessionId();
    const runtime: ModelRuntime = {
      getModels: () => [model],
      getModel: () => model,
      checkModel: async () => {
        throw new Error("No model requests in this test");
      },
      streamSimple: () => {
        throw new Error("Unexpected model request");
      },
    };
    let release!: () => void;
    let loads = 0;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loop: LoopBridge = {
      models: async () => [],
      setModel: async () => {},
      list: async () => [{ ...manager.getHeader(), workspaceId: project.id, messageCount: 0 }],
      load: async () => {
        loads++;
        await wait;

        return new AgentSession({
          model,
          modelRuntime: runtime,
          sessionManager: manager,
          systemPrompt: "Test",
          tools: [],
        });
      },
    };
    const registry = new SessionRegistry(projects, loop);

    await registry.list(project.id);
    const a = registry.get(id);
    const b = registry.get(id);

    for (let i = 0; i < 100 && !loads; i++) await Bun.sleep(2);

    expect(loads).toBe(1);
    await expect(registry.remove(project.id)).rejects.toThrow("project_busy");
    release();
    expect(await a).toBe(await b);
    const controller = await a;

    controller.prompt("first", "hello");
    await expect(registry.remove(project.id)).rejects.toThrow("project_busy");
    await controller.abort();
    await registry.remove(project.id);
    expect(() => registry.assertAvailable(project.id)).toThrow("project_not_found");
    await expect(registry.get(id)).rejects.toThrow("session_not_found");
    expect(await Bun.file(join(root, "projects.json")).exists()).toBe(true);
    await registry.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
