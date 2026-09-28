import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { AgentSession, SessionManager } from "../../coding-agent/index";
import type { ModelRuntime } from "../../coding-agent/index";
import type { LoopBridge } from "./loop";
import { ProjectStore } from "./projects/project-store";
import { SessionRegistry } from "./session-registry";
import type { ListFrame } from "../shared/protocol";

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
    const stream = createAssistantMessageEventStream();
    const id = manager.getSessionId();
    const runtime: ModelRuntime = {
      getModels: () => [model],
      getModel: () => model,
      checkModel: async () => {},
      streamSimple: () => stream,
    };
    let release!: () => void;
    let loads = 0;
    let releaseArchive!: () => void;
    let archiving = false;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loop: LoopBridge = {
      models: async () => [],
      deleteSessions: async () => {},
      archive: async () => {
        archiving = true;
        await new Promise<void>((resolve) => {
          releaseArchive = resolve;
        });
      },
      setModel: async () => {},
      list: async () => [
        {
          ...manager.getHeader(),
          title: manager.getHeader().title?.text,
          workspaceId: project.id,
          messageCount: 0,
          userMessageCount: 0,
        },
      ],
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
    const changes: ListFrame[] = [];
    registry.events.connect((frame) => changes.push(frame));

    expect((await registry.list(project.id))[0]?.isGenerating).toBe(false);
    expect(loads).toBe(0);
    const a = registry.get(id);
    const b = registry.get(id);

    for (let i = 0; i < 100 && !loads; i++) await Bun.sleep(2);

    expect(loads).toBe(1);
    await expect(registry.remove(project.id)).rejects.toThrow("project_busy");
    await expect(registry.archive(project.id, [id], true)).rejects.toThrow("project_busy");
    await expect(registry.archive(project.id, [id], "delete")).rejects.toThrow("project_busy");
    await expect(registry.archive(project.id, [id], "delete-session")).rejects.toThrow(
      "project_busy",
    );
    release();
    expect(await a).toBe(await b);
    const controller = await a;
    expect(changes.map((frame) => frame.type)).toEqual(["lists.reset"]);

    controller.prompt("first", "hello");
    expect(changes.at(-1)).toMatchObject({ type: "sessions.changed", workspaceId: project.id });
    await expect(registry.archive(project.id, [id], "delete-session")).rejects.toThrow(
      "project_busy",
    );
    expect((await registry.list(project.id))[0]?.isGenerating).toBe(true);
    await expect(registry.remove(project.id)).rejects.toThrow("project_busy");
    await expect(registry.archive(project.id, [id], true)).rejects.toThrow("project_busy");
    const beforeAbort = changes.length;
    await controller.abort();
    expect(changes.length).toBeGreaterThan(beforeAbort);
    expect((await registry.list(project.id))[0]?.isGenerating).toBe(false);
    for (const operation of ["model", "flush", "title"] as const) {
      await controller.command(operation, async () => {
        expect((await registry.list(project.id))[0]?.isGenerating).toBe(false);
      });
    }
    const archive = registry.archive(project.id, [id], true);
    for (let i = 0; i < 100 && !archiving; i++) await Bun.sleep(2);
    expect(archiving).toBe(true);
    await expect(registry.create(project.id)).rejects.toThrow("project_busy");
    await expect(registry.remove(project.id)).rejects.toThrow("project_busy");
    releaseArchive();
    await archive;
    expect(changes.at(-1)).toMatchObject({ type: "sessions.changed", workspaceId: project.id });
    await registry.remove(project.id);
    expect(changes.at(-1)).toMatchObject({ type: "projects.changed", workspaceId: project.id });
    expect(() => registry.assertAvailable(project.id)).toThrow("project_not_found");
    await expect(registry.get(id)).rejects.toThrow("session_not_found");
    expect(await Bun.file(join(root, "projects.json")).exists()).toBe(true);
    await registry.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed archive work notifies list subscribers so partial changes can be recovered", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".registry-notification-test-"));
  const projects = new ProjectStore(join(root, "projects.json"));
  const registry = new SessionRegistry(projects, {
    models: async () => [],
    list: async () => [],
    load: async () => {
      throw new Error("Unexpected load");
    },
    archive: async () => {
      throw new Error("Save failed");
    },
    deleteSessions: async () => {},
    setModel: async () => {},
  });
  try {
    const project = await projects.add(root);
    const changes: ListFrame[] = [];
    registry.events.connect((frame) => changes.push(frame));
    await expect(registry.archive(project.id, ["s"], true)).rejects.toThrow("Save failed");
    expect(changes).toHaveLength(2);
    expect(changes.at(-1)).toMatchObject({ type: "sessions.changed", workspaceId: project.id });
    expect(() => registry.assertAvailable(project.id)).not.toThrow();
  } finally {
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});
