import type { McpConnector } from "./types";

export const discoverMcpTools = async (connector: McpConnector) => {
  try {
    return await connector.listTools();
  } catch (error) {
    throw new Error(
      `MCP discovery failed for ${connector.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const invokeMcpTool = async (
  connector: McpConnector,
  name: string,
  input: Record<string, unknown>,
) => {
  if (!connector.invoke)
    throw new Error(`MCP connector ${connector.name} does not support invocation`);
  try {
    return await connector.invoke(name, input);
  } catch (error) {
    throw new Error(
      `MCP invocation failed for ${connector.name}/${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
