export type Message = { role: "system" | "user" | "assistant" | "tool"; content: string };

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type ModelRequest = {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
};

export type ModelResponse = {
  text: string;
  toolCalls?: ToolCall[];
  finishReason?: "stop" | "tool_use" | "error";
};

export type ProviderCapabilities = {
  tools: boolean;
  vision: boolean;
  json: boolean;
  reasoning: boolean;
};

export interface Provider {
  readonly name: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
  supports(model: string, capability: keyof ProviderCapabilities): boolean;
  normalizeError(error: unknown): Error;
}
