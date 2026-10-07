import { CodemodeSandbox, parseCodemodeSource } from "@earendil-works/pi-codemode";
import type { AgentTool } from "@loop/agent";

import type { PermissionTool } from "../approvals/tool-approvals";
import type { McpPromptServer } from "../mcp/mcp-manager";
import { validateSessionToolArguments } from "../model-runtime";
import { createCodemodeCatalog } from "./catalog";
import { renderCodemodeOutput } from "./output";

const MAX_SCRIPT_BYTES = 64 * 1024;
const MAX_CALLS = 64;
const TIMEOUT_MS = 300_000;

/** The script receives only isolated JSON tool bridges, never host runtime objects. */
export const createCodemodeTool = (
  tools: readonly AgentTool[],
  servers: readonly McpPromptServer[],
): PermissionTool => ({
  name: "codemode",
  displayName: "Codemode",
  description:
    'Run JavaScript in an isolated QuickJS worker to discover, call and filter tools, including MCPs. Submit {code: raw JavaScript}; top-level await and return work. No Node, filesystem, fetch, imports or timers. Helpers: await searchTools(query, {limit?, namespace?}) returns names and descriptions; await describeTool(name) returns parameters; await describeNamespace(serverId) lists tools; ALL_TOOLS lists all names/descriptions. Call await tools[name]({args}); general tools return text, MCP tools return {content: text/image blocks}. Use text(value), image(block), or return to emit only needed results. Every nested call follows existing permissions and runs sequentially. Await calls; pending calls are cancelled when the script ends. Maximum 64 calls and 5 minutes per script. Optional first line // @options: {"timeout_ms": 30000}. Scripts start fresh; store/load are not persisted. Failures never retry or roll back earlier effects.',
  parameters: {
    type: "object",
    properties: { code: { type: "string", description: "JavaScript async function body" } },
    required: ["code"],
    additionalProperties: false,
  },
  execute: async (args, signal, approval) => {
    if (typeof args.code !== "string" || Buffer.byteLength(args.code) > MAX_SCRIPT_BYTES)
      throw new Error("Codemode needs JavaScript source below 64 KiB");
    if (!approval?.executeNested) throw new Error("Codemode execution context is unavailable");
    const parsed = parseCodemodeSource(args.code);
    const timeout = parsed.options.timeoutMs ?? TIMEOUT_MS;
    if (timeout > TIMEOUT_MS) throw new Error("Codemode timeout cannot exceed five minutes");
    const mcp = new Set(servers.flatMap((server) => server.toolNames));
    const limits = new AbortController();
    let calls = 0;
    let queue: Promise<unknown> = Promise.resolve();
    const sandbox = new CodemodeSandbox({
      timeoutMs: timeout,
      memoryLimitBytes: 256 * 1024 * 1024,
      globals: createCodemodeCatalog(tools, servers),
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        execute: (input, context) => {
          if (++calls > MAX_CALLS) {
            const error = new Error("Codemode exceeded its 64-call limit");
            limits.abort(error);
            throw error;
          }
          const nestedSignal = AbortSignal.any([signal, context.signal]);
          const pending = queue.then(async () => {
            nestedSignal.throwIfAborted();
            if (!input || typeof input !== "object" || Array.isArray(input))
              throw new Error("Tool arguments must be an object");
            const args = validateSessionToolArguments(
              tool,
              input as Record<string, unknown>,
              "nested",
            );
            const content = await approval.executeNested!(tool, args, nestedSignal);
            nestedSignal.throwIfAborted();
            return mcp.has(tool.name)
              ? { content }
              : content
                  .filter((block) => block.type === "text")
                  .map((block) => block.text)
                  .join("\n");
          });
          queue = pending.catch(() => {});
          return pending;
        },
      })),
    });
    try {
      const result = await sandbox.execute(parsed.code, {
        signal: AbortSignal.any([signal, limits.signal]),
      });
      signal.throwIfAborted();
      const content = renderCodemodeOutput(result, parsed.options.maxOutputTokens);
      if (!result.ok) {
        throw new Error(
          content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n"),
        );
      }
      return content;
    } finally {
      await sandbox.close();
    }
  },
});
