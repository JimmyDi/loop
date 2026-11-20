import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { connectMcp } from "../mcp/connection";
import { writeMcpConfigs } from "../mcp/config-store";
import type { McpServerConfig } from "../mcp/types";
import { McpSandboxExecution } from "./mcp-sandbox";
import { createAgentSession } from "../sdk";
import { createModelRuntime } from "../model-runtime";
import { buildSessionModelContext } from "../context/session-model-context";

vi.mock("../mcp/connection", () => ({ connectMcp: vi.fn() }));

test("arbitrary provider schemas replace local tools and per-chat identity overrides configured headers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-provider-"));
  const config: McpServerConfig = {
    id: "provider",
    name: "Custom sandbox",
    enabled: true,
    transport: "http",
    url: "https://sandbox.example/mcp/",
    bearerTokenEnv: "",
    headers: [{ key: "Loop-Session-Id", value: "wrong" }],
    envHeaders: [],
  };
  const call = vi.fn(async () => [{ type: "text" as const, text: "ordinary provider output" }]);
  const close = vi.fn(async () => {});
  vi.mocked(connectMcp).mockImplementation(async () => ({
    tools: [
      {
        name: "run_custom_command",
        inputSchema: {
          type: "object",
          properties: { script: { type: "string" } },
          required: ["script"],
        },
      },
    ],
    call,
    close,
    refresh: async () => [],
  }));
  const model = createModelRuntime().getModel("anthropic", "claude-opus-4-5")!;
  try {
    await writeMcpConfigs(join(directory, "mcp.json"), [config]);
    const { session } = await createAgentSession({
      cwd: directory,
      agentDir: directory,
      model,
      modelRuntime: {
        getModel: () => model,
        getModels: () => [model],
        checkModel: async () => {},
        streamSimple: () => {
          throw new Error("No model call");
        },
      },
      execution: { type: "sandbox", serverId: "provider" },
      telemetry: false,
    });
    expect(session.state.sandboxServerId).toBe("provider");
    expect(session.state.sandboxLabel).toBe("Custom sandbox");
    expect(session.sessionManager.getHeader().execution).toEqual({
      type: "sandbox",
      serverId: "provider",
    });
    const scoped = vi.mocked(connectMcp).mock.calls[0]![0];
    expect(scoped.transport === "http" && scoped.headers).toEqual([
      { key: "Loop-Session-Id", value: session.sessionId },
    ]);
    const execution = await McpSandboxExecution.create(directory, "provider", session.sessionId);
    const context = buildSessionModelContext(
      {
        model,
        modelRuntime: createModelRuntime(),
        sessionManager: session.sessionManager,
        tools: execution.tools(),
        sandboxExecution: execution,
        systemPrompt: "remote",
      },
      model,
    );
    expect(
      context.tools.map((tool) => tool.name).filter((name) => name !== "request_user_input"),
    ).toHaveLength(1);
    const tool = execution.tools()[0]!;
    expect(tool.parameters).toMatchObject({ required: ["script"] });
    const signal = new AbortController().signal;
    const approval = { arguments: {}, request: vi.fn(async () => ({ outcome: "allowed-once" })) };
    await expect(tool.execute({ script: "hello" }, signal, approval as never)).resolves.toEqual([
      { type: "text", text: "ordinary provider output" },
    ]);
    expect(call).toHaveBeenCalledTimes(1);
    await writeMcpConfigs(join(directory, "mcp.json"), [{ ...config, enabled: false }]);
    await expect(tool.execute({ script: "again" }, signal, approval as never)).rejects.toThrow(
      /outcome may be unknown/,
    );
    expect(call).toHaveBeenCalledTimes(1);
    await execution.close();
    session.dispose();
    await expect(McpSandboxExecution.create(directory, "provider", "other")).rejects.toThrow(
      /disabled/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("STDIO provider gets stable chat identity and closes when discovery has no tools", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-stdio-sandbox-"));
  const close = vi.fn(async () => {});
  vi.mocked(connectMcp).mockResolvedValue({
    tools: [],
    call: vi.fn(),
    close,
    refresh: async () => [],
  });
  try {
    await writeMcpConfigs(join(directory, "mcp.json"), [
      {
        id: "stdio",
        name: "STDIO sandbox",
        enabled: true,
        transport: "stdio",
        command: "synthetic-adapter",
        args: [],
        cwd: "",
        env: [{ key: "LOOP_SESSION_ID", value: "wrong" }],
        envVars: ["LOOP_SESSION_ID"],
      },
    ]);
    await expect(McpSandboxExecution.create(directory, "stdio", "stable-chat")).rejects.toThrow(
      /no tools/,
    );
    const scoped = vi.mocked(connectMcp).mock.calls.at(-1)![0];
    expect(scoped.transport === "stdio" && scoped.env).toEqual([
      { key: "LOOP_SESSION_ID", value: "stable-chat" },
    ]);
    expect(scoped.transport === "stdio" && scoped.envVars).toEqual([]);
    expect(close).toHaveBeenCalled();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
