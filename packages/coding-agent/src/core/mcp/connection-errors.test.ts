import { expect, test } from "vitest";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import { McpConnectionError, mcpFailureCode } from "./connection-errors";

test("classifies known failures without passing server diagnostics to the UI", () => {
  expect(mcpFailureCode(new UnauthorizedError("synthetic diagnostic"))).toBe(
    "authentication_required",
  );
  expect(mcpFailureCode(new StreamableHTTPError(403, "synthetic diagnostic"))).toBe(
    "authentication_required",
  );
  expect(mcpFailureCode(new McpError(ErrorCode.RequestTimeout, "synthetic diagnostic"))).toBe(
    "connection_timeout",
  );
  expect(mcpFailureCode(Object.assign(new Error("synthetic path"), { code: "ENOENT" }))).toBe(
    "command_not_found",
  );
  expect(mcpFailureCode(new McpConnectionError("missing_environment"))).toBe("missing_environment");
  expect(mcpFailureCode(new Error("synthetic private diagnostic"))).toBe("connection_failed");
});
