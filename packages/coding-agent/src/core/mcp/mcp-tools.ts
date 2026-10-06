import { createHash } from "node:crypto";
import type { AgentTool } from "@loop/agent";

import type { PermissionTool } from "../approvals/tool-approvals";
import type { McpConnection } from "./connection";
import type { McpServerConfig } from "./types";

export const createMcpTools = (
  config: McpServerConfig,
  connection: McpConnection,
  lifetime: AbortSignal,
  current: () => boolean,
  workspaceRoot: string,
): PermissionTool[] => {
  if (!config.enabled) return [];

  return connection.tools.map((tool) => {
    const hash = createHash("sha256")
      .update(config.id + "/" + tool.name)
      .digest("hex")
      .slice(0, 16);
    const name =
      "mcp_" +
      config.id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) +
      "_" +
      tool.name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) +
      "_" +
      hash;
    return {
      name,
      displayName: config.name + " · " + tool.name,
      description:
        "MCP server: " + config.name + ". Tool: " + tool.name + ". " + (tool.description ?? ""),
      parameters: structuredClone(tool.inputSchema) as AgentTool["parameters"],
      execute: async (args, signal, approval) => {
        const combined = AbortSignal.any([signal, lifetime]);
        combined.throwIfAborted();
        if (!current() || !approval) throw new Error("MCP tool is no longer available");
        const decision = await approval.request(
          {
            kind: "mcp-tool",
            workspaceRoot,
            arguments: approval.arguments,
            serverName: config.name,
            transport: config.transport,
            toolName: tool.name,
          },
          "Call " + tool.name + " on MCP server " + config.name,
          combined,
          {
            mcp: {
              lifetime,
              toolKey: tool.name,
            },
          },
        );
        combined.throwIfAborted();
        if (decision.outcome !== "allowed-once" && decision.outcome !== "allowed-session")
          throw new Error("MCP tool approval was not granted");
        if (!current()) throw new Error("MCP configuration changed; call was not dispatched");
        try {
          return await connection.call(tool.name, structuredClone(args), combined);
        } catch {
          throw new Error(
            "MCP tool failed or was interrupted; its external outcome may be unknown. No retry was performed.",
          );
        }
      },
    };
  });
};
