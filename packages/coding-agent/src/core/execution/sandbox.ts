import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { AgentTool } from "@loop/agent";

import type { PermissionTool } from "../approvals/tool-approvals";
import { sandboxToken } from "./connection";
import type { ExecutionEnvironment, SandboxStatus } from "./types";

const definitions = [
  {
    name: "read_file",
    description: "Read a UTF-8 sandbox file (up to 1 MB).",
    fields: { path: { type: "string" } },
    required: ["path"],
  },
  {
    name: "write_file",
    description: "Write a UTF-8 sandbox file (up to 1 MB).",
    fields: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
  {
    name: "edit_file",
    description: "Replace exactly one matching occurrence in a sandbox file.",
    fields: {
      path: { type: "string" },
      old_text: { type: "string", minLength: 1 },
      new_text: { type: "string" },
    },
    required: ["path", "old_text", "new_text"],
  },
  {
    name: "exec",
    description: "Start a sandbox Bash command. Poll get_process for completion and output.",
    fields: {
      command: { type: "string" },
      cwd: { type: "string" },
      timeout: { type: "integer", minimum: 1, maximum: 1800 },
    },
    required: ["command"],
  },
  {
    name: "get_process",
    description: "Read command status and output from a byte cursor.",
    fields: { process_id: { type: "string" }, cursor: { type: "integer", minimum: 0 } },
    required: ["process_id"],
  },
  {
    name: "cancel_process",
    description: "Stop a sandbox command and its descendants.",
    fields: { process_id: { type: "string" } },
    required: ["process_id"],
  },
];

/** Dedicated per-session MCP client. No local execution and no business-call retries. */
export class SandboxExecution {
  private connection?: Promise<Client>;
  private client?: Client;
  private transport?: StreamableHTTPClientTransport;
  private closed = false;
  private status?: SandboxStatus;
  private readonly lifetime = new AbortController();
  private readonly processes = new Set<string>();

  constructor(
    private readonly config: Extract<ExecutionEnvironment, { url: string }>,
    private readonly sessionId: string,
  ) {}

  get snapshot(): SandboxStatus | undefined {
    return this.status ? { ...this.status } : undefined;
  }

  tools(): PermissionTool[] {
    return definitions.map(({ name, description, fields, required }) => ({
      name,
      description,
      parameters: {
        type: "object",
        properties: fields,
        required,
        additionalProperties: false,
      } as AgentTool["parameters"],
      execute: async (args, signal, approval) => {
        if (!approval) throw new Error("Sandbox approval context is unavailable");
        const decision = await approval.request(
          {
            kind: "mcp-tool",
            workspaceRoot: "/workspace",
            arguments: approval.arguments,
            serverName: "Loop Sandbox",
            toolName: name,
            transport: "http",
          },
          "Call " + name + " in the disposable sandbox",
          signal,
          {
            mcp: { lifetime: this.lifetime.signal, toolKey: name },
          },
        );
        if (decision.outcome !== "allowed-once" && decision.outcome !== "allowed-session")
          throw new Error("Sandbox tool approval was not granted");
        return this.call(name, args, signal);
      },
    }));
  }

  async cancelRunning(): Promise<void> {
    for (const process_id of [...this.processes]) {
      try {
        await this.call("cancel_process", { process_id }, AbortSignal.timeout(10_000));
      } catch {
        /* Remote outcome remains unknown; server-side limits still apply. */
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.lifetime.abort();
    await this.connection?.catch(() => undefined);
    await this.client?.close().catch(() => {});
    await this.transport?.close().catch(() => {});
  }

  private async connect(): Promise<Client> {
    if (this.closed) throw new Error("Sandbox connection is closed");
    const token = sandboxToken(this.config);
    const client = new Client({ name: "loop", version: "1.0.0" }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: {
        headers: { Authorization: "Bearer " + token, "Loop-Session-Id": this.sessionId },
        redirect: "error",
      },
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1,
      },
    });
    this.client = client;
    this.transport = transport;
    try {
      await client.connect(transport, { timeout: 10_000 });
      const catalog = await client.listTools({}, { timeout: 10_000 });
      if (definitions.some(({ name }) => !catalog.tools.some((tool) => tool.name === name)))
        throw new Error("Sandbox MCP server does not provide the required tools");
      return client;
    } catch (error) {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
      throw error;
    }
  }

  private async call(name: string, args: Record<string, unknown>, signal: AbortSignal) {
    signal.throwIfAborted();
    const client = await (this.connection ??= this.connect().catch((error) => {
      this.connection = undefined;
      throw error;
    }));
    signal.throwIfAborted();
    try {
      const response = CallToolResultSchema.parse(
        await client.callTool({ name, arguments: args }, CallToolResultSchema, {
          signal,
          timeout: 60_000,
        }),
      );
      const text = response.content.find((item) => item.type === "text");
      const data =
        response.structuredContent ??
        (text?.type === "text" ? (JSON.parse(text.text) as Record<string, unknown>) : undefined);
      const result = data?.result as Record<string, unknown> | undefined;
      if (typeof result?.process_id === "string") {
        if (name === "exec") this.processes.add(result.process_id);
        if (result.running === false) this.processes.delete(result.process_id);
      }
      const sandbox = data?.sandbox as Record<string, unknown> | undefined;
      if (sandbox && typeof sandbox.generation === "number")
        this.status = {
          generation: sandbox.generation,
          recreated: sandbox.recreated === true,
          filesRestored: sandbox.files_restored === true,
        };
      return response.content
        .filter((item) => item.type === "text")
        .map((item) => ({ type: "text" as const, text: item.text }));
    } catch {
      // A broken transport can reconnect on a later call; never replay this call.
      this.connection = undefined;
      await client.close().catch(() => {});
      throw new Error(
        "Sandbox call failed or was interrupted; outcome may be unknown. No retry or local fallback was performed.",
      );
    }
  }
}
