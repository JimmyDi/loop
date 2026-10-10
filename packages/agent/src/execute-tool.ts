import { validateToolArguments } from "@earendil-works/pi-ai";
import type { ToolCall, ToolResultMessage } from "@earendil-works/pi-ai";

import type { AgentTool } from "./types";

export const executeTool = async (
  call: ToolCall,
  tools: readonly AgentTool[],
  signal: AbortSignal,
): Promise<ToolResultMessage> => {
  try {
    signal.throwIfAborted();

    const tool = tools.find((item) => item.name === call.name);

    if (!tool) {
      const names = tools.slice(0, 20).map((item) => item.name);
      throw new Error(
        "Tool not found: " +
          call.name +
          ". No tool was executed. " +
          (names.length
            ? "Available tools: " +
              names.join(", ") +
              (tools.length > names.length ? " (first 20)" : "") +
              ". Use exact names from the current tool declarations."
            : "No tools are currently available."),
      );
    }

    const parameters = validateToolArguments(tool, call);

    signal.throwIfAborted();

    const content = await tool.execute(parameters, signal);

    signal.throwIfAborted();

    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: call.name,
      content,
      isError: false,
      timestamp: Date.now(),
    };
  } catch (error) {
    return createToolError(call, signal.aborted ? signal.reason : error);
  }
};

export const createToolError = (call: ToolCall, error: unknown): ToolResultMessage => {
  return {
    role: "toolResult",
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    isError: true,
    timestamp: Date.now(),
  };
};
