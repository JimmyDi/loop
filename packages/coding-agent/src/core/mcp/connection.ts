import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AgentTool } from "@loop/agent";

import { McpConnectionError, mcpFailureCode } from "./connection-errors";
import { readMcpToolCatalog } from "./tool-catalog";
import type { McpFailureCode, McpServerConfig } from "./types";

export type McpConnection = {
  tools: Tool[];
  refresh(signal: AbortSignal): Promise<Tool[]>;
  call(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Awaited<ReturnType<AgentTool["execute"]>>>;
  close(): Promise<void>;
};

export type McpConnector = (
  config: McpServerConfig,
  signal: AbortSignal,
  changed: (event: "catalog" | "closed", error?: McpFailureCode) => void,
  initializeTimeoutMs?: number,
) => Promise<McpConnection>;

const environment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) throw new McpConnectionError("missing_environment");
  return value;
};

const transportFor = (config: McpServerConfig): Transport => {
  if (config.transport === "stdio") {
    const env = getDefaultEnvironment();
    for (const name of config.envVars) env[name] = environment(name);
    for (const { key, value } of config.env) env[key] = value;
    return new StdioClientTransport({
      command: config.command,
      args: config.args,
      env,
      cwd: config.cwd || undefined,
      stderr: "ignore",
    });
  }
  const headers = new Headers();
  for (const { key, value } of config.headers) headers.set(key, value);
  for (const { key, value } of config.envHeaders) headers.set(key, environment(value));
  if (config.bearerTokenEnv)
    headers.set("Authorization", "Bearer " + environment(config.bearerTokenEnv));
  return new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers, redirect: "error" },
    reconnectionOptions: {
      maxRetries: 0,
      maxReconnectionDelay: 1000,
      initialReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1,
    },
  });
};

/** Discovery performs initialize/listTools only; it never invokes business tools. */
export const connectMcp: McpConnector = async (
  config,
  signal,
  changed,
  initializeTimeoutMs = 10_000,
) => {
  const transport = transportFor(config);
  const client = new Client({ name: "loop", version: "1.0.0" }, { capabilities: {} });
  let closing = false;
  const close = async () => {
    closing = true;
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  };
  const onAbort = () => {
    void close();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  client.onclose = () => {
    if (!closing) changed("closed", "connection_closed");
  };
  client.onerror = (error) => {
    if (!closing) changed("closed", mcpFailureCode(error));
  };
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => changed("catalog"));
  try {
    signal.throwIfAborted();
    await client.connect(transport, { signal, timeout: initializeTimeoutMs });
    const tools = await readMcpToolCatalog(client, signal);
    signal.throwIfAborted();
    return {
      tools,
      refresh: (refreshSignal) => readMcpToolCatalog(client, refreshSignal),
      close,
      call: async (name, args, callSignal) => {
        const result = CallToolResultSchema.parse(
          await client.callTool({ name, arguments: args }, CallToolResultSchema, {
            signal: callSignal,
            timeout: 60_000,
            maxTotalTimeout: 60_000,
          }),
        );
        if (result.isError) throw new Error("MCP tool reported an error");
        const content = result.content.map((content) => {
          if (content.type === "text") return { type: "text" as const, text: content.text };
          if (content.type === "image")
            return { type: "image" as const, data: content.data, mimeType: content.mimeType };
          return { type: "text" as const, text: JSON.stringify(content) };
        });
        if (!content.length && result.structuredContent)
          content.push({ type: "text", text: JSON.stringify(result.structuredContent) });
        return content;
      },
    };
  } catch (error) {
    await close();
    throw new McpConnectionError(mcpFailureCode(error));
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};
