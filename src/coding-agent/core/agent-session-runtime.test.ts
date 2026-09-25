import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgentSessionRuntime } from "./agent-session-runtime";
import { createAgentSession } from "./sdk";
import { createModelRuntime } from "./model-runtime";
import type { ModelRuntime } from "./model-runtime";
import { SessionManager } from "./session-manager";
import { SettingsManager } from "./settings-manager";

test("runtime preserves current session on failure, switches cwd/history and rejects busy replacement", async () => {
  const firstDir = await mkdtemp(join(tmpdir(), "loop-runtime-"));
  const secondDir = await mkdtemp(join(tmpdir(), "loop-runtime-other-"));
  const base = createModelRuntime();
  const model = base.getModel("anthropic", "claude-opus-4-5")!;
  let wait = false;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const modelRuntime: ModelRuntime = {
    ...base,
    checkModel: async () => {},
    streamSimple: () => {
      const stream = createAssistantMessageEventStream();

      started();

      if (wait) return stream;

      const message: AssistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "answer" }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: 0,
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

      stream.push({ type: "start", partial: message });
      stream.push({ type: "done", reason: "stop", message });

      return stream;
    },
  };
  const firstManager = await SessionManager.create(firstDir, firstDir);
  const otherManager = await SessionManager.create(secondDir, secondDir);

  await otherManager.setModel({ provider: model.provider, id: model.id });
  await otherManager.commit([{ role: "user", content: "other history", timestamp: 1 }]);

  const runtime = await createAgentSessionRuntime(
    (options) =>
      createAgentSession({
        ...options,
        modelRuntime,
        noContextFiles: true,
        settingsManager: SettingsManager.inMemory(),
      }),
    { cwd: firstDir, sessionManager: firstManager, model },
  );
  let bindings = 0;

  runtime.setRebindSession(() => {
    bindings++;
  });

  try {
    const original = runtime.session;

    await expect(runtime.switchSession(join(firstDir, "missing.jsonl"))).rejects.toThrow();
    expect(runtime.session).toBe(original);
    await original.prompt("first");
    await runtime.newSession();
    expect(runtime.session.state.messages).toEqual([]);
    expect(bindings).toBe(1);
    await expect(original.prompt("stale")).rejects.toThrow("disposed");
    expect((await SessionManager.open(firstManager.sessionFile!)).messages).toHaveLength(2);
    await runtime.switchSession(otherManager.sessionFile!);
    expect(runtime.cwd).toBe(otherManager.getCwd());
    expect(runtime.session.state.messages[0]).toMatchObject({ content: "other history" });
    expect(bindings).toBe(2);

    wait = true;

    const running = runtime.session.prompt("wait").catch(() => {});

    await ready;
    await expect(runtime.newSession()).rejects.toThrow("already running");
    await runtime.session.abort();
    await running;
    expect(runtime.session.isRunning).toBe(false);
  } finally {
    await runtime.dispose();
    await rm(firstDir, { recursive: true, force: true });
    await rm(secondDir, { recursive: true, force: true });
  }
});
