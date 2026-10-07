import type { AgentEvent, AgentTool } from "@loop/agent";
import type {
  ApprovalInput,
  ApprovalOperation,
  ApprovalRequestOptions,
  ApprovalResult,
} from "./types";

/** Host-only execution context, passed separately from model-provided arguments. */
export type ToolApprovalContext = {
  arguments: Record<string, unknown>;
  /** Host-only bridge; scripts receive results, never this context or tool executors. */
  executeNested?: (
    tool: AgentTool,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<Awaited<ReturnType<AgentTool["execute"]>>>;
  request: (
    operation: ApprovalOperation,
    reason: string,
    signal?: AbortSignal,
    options?: Pick<ApprovalRequestOptions, "mcp">,
  ) => Promise<ApprovalResult>;
};

export type PermissionTool = Omit<AgentTool, "execute"> & {
  displayName?: string;
  execute: (
    args: Record<string, unknown>,
    signal: AbortSignal,
    approval?: ToolApprovalContext,
  ) => ReturnType<AgentTool["execute"]>;
};

/** Associates sequential tool execution with its core-observed call ID, without changing Agent. */
export class ToolApprovals {
  private call?: { id: string; name: string };

  constructor(
    private readonly request: (
      input: ApprovalInput,
      options: ApprovalRequestOptions,
    ) => Promise<ApprovalResult>,
  ) {}

  onEvent(event: AgentEvent): void {
    if (event.type === "tool_execution_start")
      this.call = { id: event.toolCallId, name: event.toolName };
    if (event.type === "tool_execution_end") this.call = undefined;
  }

  bind(tools: AgentTool[]): AgentTool[] {
    return tools.map((tool: PermissionTool) => ({
      ...tool,
      execute: async (args, signal) => {
        const call = this.call;
        this.call = undefined;
        if (!call || call.name !== tool.name) throw new Error("Tool call context is unavailable");
        return this.execute(tool, args, signal, call.id);
      },
    }));
  }

  private async execute(
    tool: PermissionTool,
    args: Record<string, unknown>,
    signal: AbortSignal,
    id: string,
  ): Promise<Awaited<ReturnType<AgentTool["execute"]>>> {
    const parameters = structuredClone(args);
    let active = true;
    let requested = false;
    let nested = 0;
    try {
      signal.throwIfAborted();
      return await tool.execute(parameters, signal, {
        arguments: structuredClone(parameters),
        executeNested: (child, childArgs, childSignal) => {
          signal.throwIfAborted();
          if (!active) throw new Error("Approval call context has expired");
          return this.execute(
            child,
            childArgs,
            AbortSignal.any([signal, childSignal]),
            id + "/" + ++nested,
          );
        },
        request: (operation, reason, operationSignal, options) => {
          signal.throwIfAborted();
          if (!active || requested) throw new Error("Approval call context has expired");
          requested = true;
          return this.request(
            { toolCallId: id, toolName: tool.name, reason, operation },
            {
              ...options,
              signal: operationSignal ? AbortSignal.any([signal, operationSignal]) : signal,
            },
          );
        },
      });
    } finally {
      active = false;
    }
  }
}
