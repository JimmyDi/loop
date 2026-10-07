import { toCodemodeIdentifier } from "@earendil-works/pi-codemode";
import type { CodemodeTool } from "@earendil-works/pi-codemode";
import type { AgentTool } from "@loop/agent";

import type { McpPromptServer } from "../mcp/mcp-manager";

type ToolSummary = { name: string; description: string; namespace: string };

/** Discovery stays inside the sandbox; only explicitly emitted matches enter model context. */
export const createCodemodeCatalog = (
  tools: readonly AgentTool[],
  servers: readonly McpPromptServer[],
): CodemodeTool[] => {
  const namespaces = new Map(
    servers.flatMap((server) => server.toolNames.map((name) => [name, server.id] as const)),
  );
  const records = tools.map((tool) => ({
    tool,
    name: toCodemodeIdentifier(tool.name),
    namespace: namespaces.get(tool.name) ?? "builtin",
  }));
  if (new Set(records.map((row) => row.name)).size !== records.length) {
    throw new Error("Codemode tool names collide after normalization");
  }
  const summary = (row: (typeof records)[number]): ToolSummary => ({
    name: row.name,
    description: row.tool.description,
    namespace: row.namespace,
  });
  return [
    {
      name: "searchTools",
      spread: true,
      execute: (args) => {
        const [query, options] = args as [unknown, { limit?: unknown; namespace?: unknown }?];
        if (typeof query !== "string" || query.length > 1000)
          throw new Error("searchTools expects a query of at most 1000 characters");
        if (
          options !== undefined &&
          (!options || typeof options !== "object" || Array.isArray(options))
        )
          throw new Error("searchTools options must be an object");
        const limit = options?.limit ?? 10;
        if (!Number.isSafeInteger(limit) || Number(limit) < 1 || Number(limit) > 50)
          throw new Error("searchTools limit must be between 1 and 50");
        if (options?.namespace !== undefined && typeof options.namespace !== "string")
          throw new Error("searchTools namespace must be a server ID");
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        return records
          .filter((row) => !options?.namespace || row.namespace === options.namespace)
          .map((row) => {
            const haystack = (
              row.name +
              " " +
              row.tool.description +
              " " +
              row.namespace
            ).toLowerCase();
            const score = terms.reduce((value, term) => value + Number(haystack.includes(term)), 0);
            return { row, score };
          })
          .filter(({ score }) => !terms.length || score > 0)
          .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
          .slice(0, Number(limit))
          .map(({ row }) => summary(row));
      },
    },
    {
      name: "describeTool",
      execute: (name) => {
        const row = records.find((row) => row.name === name || row.tool.name === name);
        if (!row) throw new Error("Unknown tool; use searchTools or ALL_TOOLS");
        return { ...summary(row), parameters: structuredClone(row.tool.parameters) };
      },
    },
    {
      name: "describeNamespace",
      execute: (namespace) => {
        if (typeof namespace !== "string") throw new Error("Expected a server ID");
        return records.filter((row) => row.namespace === namespace).map((row) => summary(row));
      },
    },
  ];
};
