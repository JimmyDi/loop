import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgentSession } from "./sdk";
import { createModelRuntime } from "./model-runtime";
import type { ModelRuntime } from "./model-runtime";
import { SessionManager } from "./session-manager";
import { SettingsManager } from "./settings-manager";

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
    await expect(createAgentSession({ ...options, model, tools: ["unsupported"] })).rejects.toThrow(
      "Unknown tool",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
