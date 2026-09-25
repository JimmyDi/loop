// Adapted from Pi (MIT). See THIRD_PARTY_NOTICES.md.
import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Message,
  Model,
  SimpleStreamOptions,
  Tool,
  ToolCall,
  ToolResultMessage,
} from "@earendil-works/pi-ai";

export type StreamFn = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;

export type AgentTool = Pick<Tool, "name" | "description" | "parameters"> & {
  execute(
    parameters: Record<string, unknown>,
    signal: AbortSignal,
  ): ToolResultMessage["content"] | Promise<ToolResultMessage["content"]>;
};

export type AgentEvent =
  | { type: "message_start"; message: Message }
  | {
      type: "message_update";
      message: AssistantMessage;
      assistantMessageEvent: AssistantMessageEvent;
    }
  | { type: "message_end"; message: Message }
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: ToolCall["arguments"];
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      toolName: string;
      result: ToolResultMessage;
      isError: boolean;
    };

export type AgentEventListener = (event: AgentEvent) => void | Promise<void>;

export type AgentLoopOptions = {
  model: Model<Api>;
  systemPrompt?: string;
  tools?: readonly AgentTool[];
  streamFn: StreamFn;
  streamOptions?: Omit<SimpleStreamOptions, "signal">;
  maxTurns?: number;
};

export type AgentOptions = AgentLoopOptions & { messages?: readonly Message[] };
