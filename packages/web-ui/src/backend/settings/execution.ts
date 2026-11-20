import { sandboxConfiguration } from "@loop/coding-agent";
import type { McpManager, ExecutionEnvironment } from "@loop/coding-agent";

import { HttpError } from "../http/errors";

export const executionConfiguration = async (manager?: McpManager) => ({
  sandboxAvailable: Boolean(sandboxConfiguration()),
  servers: ((await manager?.list()) ?? [])
    .filter((server) => server.enabled)
    .map(({ id, name, status }) => ({ id, name, status })),
});

export const requestedExecution = async (
  value: unknown,
  manager?: McpManager,
): Promise<ExecutionEnvironment | undefined> => {
  if (value === undefined) return undefined;
  if (value === "local") return { type: "local" };
  if (typeof value === "string" && value.startsWith("mcp:")) {
    const serverId = value.slice(4);
    if (!(await manager?.list())?.some((server) => server.id === serverId && server.enabled))
      throw new HttpError(400, "sandbox_mcp_not_configured");
    return { type: "sandbox", serverId };
  }
  if (value !== "sandbox") throw new HttpError(400, "invalid_execution_environment");
  if (!sandboxConfiguration()) throw new HttpError(400, "sandbox_not_configured");
  return sandboxConfiguration()!;
};
