import type { ApprovalRequestOptions, ApprovalResult } from "./types";

type McpTool = NonNullable<ApprovalRequestOptions["mcp"]>;

/** In-memory grants belong to one live session and one catalog generation. */
export class McpGrants {
  private grants = new WeakMap<AbortSignal, Set<string>>();

  source(tool: McpTool | undefined, fullAccess: boolean): ApprovalResult["source"] {
    if (!tool || tool.lifetime.aborted) return undefined;
    if (fullAccess) return "full-access";
    return this.grants.get(tool.lifetime)?.has(tool.toolKey) ? "session-grant" : undefined;
  }

  remember(tool: McpTool): void {
    if (tool.lifetime.aborted) return;
    const grants = this.grants.get(tool.lifetime) ?? new Set<string>();
    grants.add(tool.toolKey);
    this.grants.set(tool.lifetime, grants);
  }

  clear(): void {
    this.grants = new WeakMap();
  }
}
