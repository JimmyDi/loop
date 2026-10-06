import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import type { McpFailureCode } from "./types";

/** Only stable codes cross the management boundary; never include server diagnostics. */
export class McpConnectionError extends Error {
  constructor(readonly code: McpFailureCode) {
    super(code);
  }
}

export const mcpFailureCode = (error: unknown): McpFailureCode => {
  if (error instanceof McpConnectionError) return error.code;
  if (error instanceof UnauthorizedError) return "authentication_required";
  if (error instanceof StreamableHTTPError && (error.code === 401 || error.code === 403))
    return "authentication_required";
  if (error instanceof McpError && error.code === ErrorCode.RequestTimeout)
    return "connection_timeout";
  if (error instanceof Error && "code" in error && error.code === "ENOENT")
    return "command_not_found";
  return "connection_failed";
};
