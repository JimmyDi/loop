import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { McpConnectionError } from "./connection-errors";

/** Build a complete catalog before publishing it. Never execute a tool during discovery. */
export const readMcpToolCatalog = async (client: Client, signal: AbortSignal): Promise<Tool[]> => {
  if (!client.getServerCapabilities()?.tools) return [];
  const tools: Tool[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : {}, { signal, timeout: 10_000 });
    tools.push(...page.tools);
    if (tools.length > 500 || (page.nextCursor && cursors.has(page.nextCursor)))
      throw new McpConnectionError("invalid_catalog");
    cursor = page.nextCursor;
    if (cursor) cursors.add(cursor);
  } while (cursor);
  if (new Set(tools.map((tool) => tool.name)).size !== tools.length)
    throw new McpConnectionError("invalid_catalog");
  signal.throwIfAborted();
  return tools;
};
