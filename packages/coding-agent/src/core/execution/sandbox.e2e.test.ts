import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import type { ToolCall } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

import { writeMcpConfigs } from "../mcp/config-store";
import { saveSandboxConnection } from "./connection";
import { createAgentSession } from "../sdk";
import { createModelRuntime } from "../model-runtime";
import type { ModelRuntime } from "../model-runtime";

/** Opt in against a dedicated live sandbox deployment. No real model calls. */
test.skipIf(!process.env.LOOP_SANDBOX_E2E_URL)(
  "model loop to MCP to real container, isolated by session",
  async () => {
    const service = new URL(process.env.LOOP_SANDBOX_E2E_URL!);
    service.pathname = "/sandboxes";
    const headers = { Authorization: "Bearer " + process.env.LOOP_SANDBOX_TOKEN };
    const list = async (): Promise<string[]> =>
      ((await (await fetch(service, { headers })).json()) as Array<{ sandbox_id: string }>).map(
        (item) => item.sandbox_id,
      );
    const initial = new Set(await list());
    const dir = await mkdtemp(join(tmpdir(), "loop-mcp-e2e-"));
    vi.stubEnv("LOOP_DATA_DIR", dir);
    saveSandboxConnection(process.env.LOOP_SANDBOX_E2E_URL!, process.env.LOOP_SANDBOX_TOKEN!, true);
    vi.stubEnv("LOOP_SANDBOX_TOKEN", "");
    const configured = process.env.LOOP_SANDBOX_E2E_CONFIGURED === "1";
    if (configured)
      await writeMcpConfigs(join(dir, "mcp.json"), [
        {
          id: "live-sandbox",
          name: "Configured sandbox",
          enabled: true,
          transport: "http",
          url: process.env.LOOP_SANDBOX_E2E_URL!,
          bearerTokenEnv: "",
          headers: [],
          envHeaders: [],
        },
      ]);
    const model = createModelRuntime().getModel("anthropic", "claude-opus-4-5")!;
    const steps: Array<Pick<ToolCall, "name" | "arguments">> = [
      { name: "write_file", arguments: { path: "proof.txt", content: "hello" } },
      {
        name: "edit_file",
        arguments: { path: "proof.txt", old_text: "hello", new_text: "sandbox" },
      },
      { name: "read_file", arguments: { path: "proof.txt" } },
      { name: "exec", arguments: { command: "cat proof.txt; printf ' command-complete'" } },
    ];
    let request = 0;
    let processId: string | undefined;
    let complete = false;
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: (_model, context) => {
        const names = context.tools?.map((tool) => tool.name) ?? [];
        expect(
          names.some((name) =>
            configured ? name.startsWith("mcp_live_sandbox_exec_") : name === "exec",
          ),
        ).toBe(true);
        expect(names).not.toContain("bash");
        expect(names).not.toContain("read");
        const latest = context.messages.at(-1);
        if (latest?.role === "toolResult") {
          const text = latest.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("");
          const result = JSON.parse(text);
          expect(result.error).toBeUndefined();
          if (result.result?.process_id) processId = result.result.process_id;
          if (result.result?.running === false) {
            complete = true;
            expect(result.result.exit_code).toBe(0);
            expect(result.result.output).toContain("sandbox command-complete");
          }
        }
        const step =
          steps[request++] ??
          (!complete && processId
            ? { name: "get_process", arguments: { process_id: processId } }
            : undefined);
        const message = {
          role: "assistant" as const,
          content: step
            ? [
                {
                  type: "toolCall" as const,
                  id: "call-" + request,
                  ...step,
                  name: names.find((name) =>
                    configured
                      ? name.startsWith("mcp_live_sandbox_" + step.name.slice(0, 20) + "_")
                      : name === step.name,
                  )!,
                },
              ]
            : [{ type: "text" as const, text: "Complete" }],
          api: model.api,
          provider: model.provider,
          model: model.id,
          timestamp: Date.now(),
          stopReason: step ? ("toolUse" as const) : ("stop" as const),
          usage: {
            input: 1,
            output: 1,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 2,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        };
        const stream = createAssistantMessageEventStream();
        stream.push({ type: "done", reason: message.stopReason, message });
        stream.end();
        return stream;
      },
    };
    const options = {
      cwd: dir,
      agentDir: dir,
      model,
      modelRuntime: runtime,
      telemetry: false as const,
      permissionPreset: "danger-full-access" as const,
      execution: configured
        ? { type: "sandbox" as const, serverId: "live-sandbox" }
        : {
            type: "sandbox" as const,
            url: process.env.LOOP_SANDBOX_E2E_URL!,
            tokenEnv: "LOOP_SANDBOX_TOKEN",
          },
    };
    const { session } = await createAgentSession(options);
    try {
      await session.prompt("Run the synthetic sandbox test");
      expect(complete).toBe(true);
      const sessionFile = session.sessionManager.getSessionFile();
      if (sessionFile)
        expect(await readFile(sessionFile, "utf8")).not.toContain(headers.Authorization.slice(7));
      expect(session.state.sandbox?.generation).toBe(1);
      await expect(readFile(join(dir, "proof.txt"))).rejects.toThrow();
      const otherRuntime: ModelRuntime = {
        ...runtime,
        streamSimple: (_model, context) => {
          const latest = context.messages.at(-1);
          const step = latest?.role !== "toolResult";
          if (!step && latest?.role === "toolResult")
            expect(JSON.stringify(latest.content)).toContain("File not found");
          const message = {
            role: "assistant" as const,
            content: step
              ? [
                  {
                    type: "toolCall" as const,
                    id: "isolation",
                    name: context.tools!.find((tool) =>
                      configured
                        ? tool.name.startsWith("mcp_live_sandbox_read_file_")
                        : tool.name === "read_file",
                    )!.name,
                    arguments: { path: "proof.txt" },
                  },
                ]
              : [{ type: "text" as const, text: "Isolated" }],
            api: model.api,
            provider: model.provider,
            model: model.id,
            timestamp: 1,
            stopReason: step ? ("toolUse" as const) : ("stop" as const),
            usage: {
              input: 1,
              output: 1,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 2,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
          };
          const stream = createAssistantMessageEventStream();
          stream.push({ type: "done", reason: message.stopReason, message });
          stream.end();
          return stream;
        },
      };
      const { session: other } = await createAgentSession({
        ...options,
        modelRuntime: otherRuntime,
      });
      try {
        await other.prompt("Verify isolation");
      } finally {
        other.dispose();
      }
    } finally {
      session.dispose();
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
      for (const id of await list())
        if (!initial.has(id)) await fetch(service.href + "/" + id, { method: "DELETE", headers });
    }
  },
  120_000,
);
