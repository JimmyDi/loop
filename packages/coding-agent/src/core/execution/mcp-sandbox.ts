import { join } from "node:path";
import type { AgentTool } from "@loop/agent";

import { readMcpConfigs } from "../mcp/config-store";
import { connectMcp } from "../mcp/connection";
import type { McpConnection } from "../mcp/connection";
import { createMcpTools } from "../mcp/mcp-tools";
import type { PermissionTool } from "../approvals/tool-approvals";
import type { SandboxStatus } from "./types";

/** A dedicated connection to exactly one user-selected MCP execution provider. */
export class McpSandboxExecution {
  private readonly lifetime = new AbortController();
  private connection?: McpConnection;
  private catalog: PermissionTool[] = [];
  private status?: SandboxStatus;
  private readonly processes = new Set<string>();
  readonly label: string;
  instructions?: string;

  private constructor(label: string) {
    this.label = label;
  }

  static async create(agentDir: string, serverId: string, sessionId: string) {
    const config = (await readMcpConfigs(join(agentDir, "mcp.json"))).find(
      (entry) => entry.id === serverId,
    );
    if (!config?.enabled) throw new Error("Selected sandbox MCP server is missing or disabled");
    const execution = new McpSandboxExecution(config.name);
    const scoped =
      config.transport === "http"
        ? {
            ...config,
            headers: [
              ...config.headers.filter(({ key }) => key.toLowerCase() !== "loop-session-id"),
              { key: "Loop-Session-Id", value: sessionId },
            ],
            envHeaders: config.envHeaders.filter(
              ({ key }) => key.toLowerCase() !== "loop-session-id",
            ),
          }
        : {
            ...config,
            env: [
              ...config.env.filter(({ key }) => key !== "LOOP_SESSION_ID"),
              { key: "LOOP_SESSION_ID", value: sessionId },
            ],
            envVars: config.envVars.filter((key) => key !== "LOOP_SESSION_ID"),
          };
    try {
      const connection = await connectMcp(scoped, execution.lifetime.signal, () =>
        execution.lifetime.abort(),
      );
      execution.connection = connection;
      execution.instructions = connection.instructions;
      if (!connection.tools.length)
        throw new Error("Selected sandbox MCP server provides no tools");
      const current = async () => {
        const latest = (await readMcpConfigs(join(agentDir, "mcp.json"))).find(
          (entry) => entry.id === serverId,
        );
        if (JSON.stringify(latest) !== JSON.stringify(config))
          throw new Error("Sandbox MCP configuration changed; reload this session");
      };
      const checked: McpConnection = {
        ...connection,
        call: async (...args) => {
          await current(); // Revalidate after approval and immediately before dispatch.
          const content = await connection.call(...args);
          execution.observe(content);
          return content;
        },
      };
      execution.catalog = createMcpTools(
        scoped,
        checked,
        execution.lifetime.signal,
        () => !execution.lifetime.signal.aborted,
        "/workspace",
      );
      return execution;
    } catch (error) {
      await execution.close();
      throw error;
    }
  }

  get snapshot() {
    return this.status ? { ...this.status } : undefined;
  }
  tools(): PermissionTool[] {
    return this.catalog;
  }
  async cancelRunning(): Promise<void> {
    // Best-effort extension for providers exposing Loop-compatible process tools.
    if (!this.connection?.tools.some((tool) => tool.name === "cancel_process")) return;
    for (const process_id of this.processes) {
      try {
        await this.connection.call("cancel_process", { process_id }, AbortSignal.timeout(10_000));
      } catch {
        /* Remote process outcome remains unknown. */
      }
    }
    this.processes.clear();
  }
  async close(): Promise<void> {
    this.lifetime.abort();
    await this.connection?.close();
  }
  private observe(content: Awaited<ReturnType<AgentTool["execute"]>>) {
    for (const item of content) {
      if (item.type !== "text") continue;
      try {
        const data = JSON.parse(item.text);
        if (typeof data?.result?.process_id === "string") {
          if (data.result.running === false) this.processes.delete(data.result.process_id);
          else this.processes.add(data.result.process_id);
        }
        if (typeof data?.sandbox?.generation === "number")
          this.status = {
            generation: data.sandbox.generation,
            recreated: data.sandbox.recreated === true,
            filesRestored: data.sandbox.files_restored === true,
          };
      } catch {
        /* Arbitrary MCP servers can return ordinary text. */
      }
    }
  }
}
