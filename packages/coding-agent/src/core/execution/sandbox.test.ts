import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { createAgentSession } from "../sdk";
import { SessionManager } from "../session-manager";
import { createModelRuntime } from "../model-runtime";
import type { ModelRuntime } from "../model-runtime";
import { buildSessionModelContext } from "../context/session-model-context";
import { SandboxExecution } from "./sandbox";
import { validateExecution } from "./types";

test("sandbox sessions persist execution identity and exclude all local capability paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-sandbox-"));
  const model = createModelRuntime().getModel("anthropic", "claude-opus-4-5")!;
  const runtime: ModelRuntime = {
    getModel: () => model,
    getModels: () => [model],
    checkModel: async () => {},
    streamSimple: () => {
      throw new Error("No model call expected");
    },
  };
  const execution = {
    type: "sandbox" as const,
    url: "http://localhost:8080/mcp/",
    tokenEnv: "SYNTHETIC_SANDBOX_TOKEN",
  };
  try {
    const { session } = await createAgentSession({
      cwd: dir,
      agentDir: dir,
      model,
      modelRuntime: runtime,
      execution,
      telemetry: false,
    });
    expect(session.state.execution).toBe("sandbox");
    expect(session.sessionManager.getHeader().execution).toEqual(execution);
    expect(() => session.setMode("plan")).toThrow(/unavailable/);
    const sandbox = new SandboxExecution(execution, session.sessionId);
    const context = buildSessionModelContext(
      {
        model,
        modelRuntime: runtime,
        sessionManager: session.sessionManager,
        systemPrompt: "remote",
        tools: sandbox.tools(),
        sandboxExecution: sandbox,
      },
      model,
    );
    const names = context.tools.map((tool) => tool.name);
    expect(names).toContain("exec");
    for (const local of ["bash", "read", "edit", "write", "load_skill", "codemode"])
      expect(names).not.toContain(local);
    const file = session.sessionManager.getSessionFile()!;
    session.dispose();
    const manager = await SessionManager.open(file);
    const { session: restored } = await createAgentSession({
      cwd: dir,
      agentDir: dir,
      model,
      modelRuntime: runtime,
      sessionManager: manager,
      telemetry: false,
    });
    expect(restored.state.execution).toBe("sandbox");
    expect(restored.sessionId).toBe(session.sessionId);
    restored.dispose();
    await sandbox.close();
    expect(() =>
      validateExecution({ type: "sandbox", url: "file:///tmp/x", tokenEnv: "TOKEN" }),
    ).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
