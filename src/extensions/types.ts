import type { ToolDefinition } from "../providers/types";

export type Capability = "read" | "write" | "network" | "shell" | "external_service";

export type Tool = ToolDefinition & {
  capabilities?: Capability[];
  resultSchema?: Record<string, unknown>;
  execute(input: Record<string, unknown>): Promise<unknown>;
};

export type Skill = { name: string; description: string; instructions: string; assets?: string[] };

export type McpConnector = {
  name: string;
  capabilities?: Capability[];
  listTools(): Promise<ToolDefinition[]>;
  invoke?(name: string, input: Record<string, unknown>): Promise<unknown>;
};
