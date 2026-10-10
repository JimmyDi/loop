import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { expect, test } from "vitest";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { createAgentSession } from "./sdk";
import { createModelRuntime } from "./model-runtime";
import type { ModelRuntime } from "./model-runtime";
import { SessionManager } from "./session-manager";
import { SettingsManager } from "./settings-manager";

test("new sessions use settings defaults and restored sessions retain their saved permissions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-sdk-"));
  const model = createModelRuntime().getModel("anthropic", "claude-opus-4-5")!;
  const modelRuntime: ModelRuntime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple: () => {
      throw new Error("No model call expected");
    },
  };
  const options = {
    model,
    modelRuntime,
    cwd: dir,
    agentDir: dir,
    noContextFiles: true,
  };
  try {
    const { session } = await createAgentSession({
      ...options,
      settingsManager: SettingsManager.inMemory(undefined, "workspace-write"),
    });
    expect(session.permissionPreset).toBe("workspace-write");
    const manager = session.sessionManager;
    session.dispose();
    const { session: restored } = await createAgentSession({
      ...options,
      sessionManager: await SessionManager.open(manager.sessionFile!),
      settingsManager: SettingsManager.inMemory(undefined, "danger-full-access"),
    });
    expect(restored.permissionPreset).toBe("workspace-write");
    restored.dispose();
    const { session: explicit } = await createAgentSession({
      ...options,
      sessionManager: await SessionManager.open(manager.sessionFile!),
      permissionPreset: "read-only",
      settingsManager: SettingsManager.inMemory(undefined, "danger-full-access"),
    });
    expect(explicit.permissionPreset).toBe("read-only");
    explicit.dispose();
    const supplied = SessionManager.inMemory(dir);
    await supplied.setPermissionPreset("workspace-write");
    const { session: configured } = await createAgentSession({
      ...options,
      sessionManager: supplied,
      settingsManager: SettingsManager.inMemory(undefined, "danger-full-access"),
    });
    expect(configured.permissionPreset).toBe("workspace-write");
    configured.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("SDK request maxTokens reaches main requests and idle budget without changing model metadata", async () => {
  const model = {
    ...createModelRuntime().getModel("anthropic", "claude-opus-4-5")!,
    api: "anthropic-messages" as const,
    maxTokens: 128000,
    contextWindow: 200000,
    compat: { forceAdaptiveThinking: false },
  };
  const manager = SessionManager.inMemory();
  await manager.commit([{ role: "user", content: "Previous task", timestamp: 0 }]);
  let calls = 0;
  const modelRuntime: ModelRuntime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple: (_selected, _context, options) => {
      calls++;
      expect(options?.maxTokens).toBe(16000);
      const stream = createAssistantMessageEventStream();
      const message = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Complete" }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: 1,
        stopReason: "stop" as const,
        usage: {
          input: 10,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 11,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };
      stream.push({ type: "done", reason: "stop", message });
      stream.end();
      return stream;
    },
  };
  const { session } = await createAgentSession({
    model,
    modelRuntime,
    sessionManager: manager,
    settingsManager: SettingsManager.inMemory(),
    noContextFiles: true,
    tools: [],
    maxTokens: 16000,
    effort: "medium",
  });
  try {
    expect(session.state.contextBudget?.reservedOutputTokens).toBe(24192);
    await session.prompt("Continue");
    expect(calls).toBe(1);
    expect(session.state.contextBudget?.reservedOutputTokens).toBe(24192);
    await session.setModel(model, { effort: "off" });
    expect(session.state.contextBudget?.reservedOutputTokens).toBe(16000);
    await session.prompt("Continue again");
    expect(calls).toBe(2);
    expect(session.model.maxTokens).toBe(128000);
    expect(manager.getHeader()).not.toHaveProperty("maxTokens");
  } finally {
    session.dispose();
  }
  for (const maxTokens of [0, -1, NaN, Infinity, 1.5]) {
    await expect(createAgentSession({ maxTokens })).rejects.toThrow("positive safe integer");
  }
});

test("factory restores saved model, rejects unavailable models and never silently replaces them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-sdk-"));
  const registry = createModelRuntime();
  const model = registry.getModel("anthropic", "claude-opus-4-5")!;
  const other = { ...model, id: "other-test-model" };
  const modelRuntime: ModelRuntime = {
    getModel: (_provider, id) => (id === model.id ? model : id === other.id ? other : undefined),
    getModels: () => [model, other],
    checkModel: async () => {},
    streamSimple: () => createAssistantMessageEventStream(),
  };
  const manager = await SessionManager.create(dir, dir);
  const options = {
    cwd: dir,
    modelRuntime,
    noContextFiles: true,
    settingsManager: SettingsManager.inMemory(),
  };

  try {
    const { session } = await createAgentSession({ ...options, model, sessionManager: manager });

    await session.setModel(other);
    session.dispose();

    const restoredManager = await SessionManager.open(manager.sessionFile!);
    const { session: restored } = await createAgentSession({
      ...options,
      sessionManager: restoredManager,
    });

    expect(restored.model.id).toBe(other.id);
    restored.dispose();
    await restoredManager.setModel({ provider: "missing", id: "missing" });
    await expect(
      createAgentSession({ ...options, sessionManager: restoredManager }),
    ).rejects.toThrow("Model unavailable");
    expect(restoredManager.getHeader().model?.id).toBe("missing");
    const unavailableRuntime: ModelRuntime = {
      ...modelRuntime,
      checkModel: async (selected) => {
        if (!modelRuntime.getModel(selected.provider, selected.id))
          throw new Error("Model unavailable");
      },
      streamSimple: () => {
        throw new Error("Must not stream an unavailable model");
      },
    };
    const { session: readable } = await createAgentSession({
      ...options,
      modelRuntime: unavailableRuntime,
      sessionManager: restoredManager,
      allowUnavailableModel: true,
    });
    expect(readable.model.id).toBe("missing");
    await expect(readable.prompt("test")).rejects.toThrow("Model unavailable");
    expect(readable.state.messages).toEqual([]);
    await readable.setModel(model);
    expect(readable.model.id).toBe(model.id);
    readable.dispose();
    await expect(createAgentSession({ ...options, model, tools: ["unsupported"] })).rejects.toThrow(
      "Unknown tool",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
