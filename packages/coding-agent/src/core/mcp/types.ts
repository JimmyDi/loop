export type McpValue = { key: string; value: string; saved?: boolean };

export type McpServerConfig = {
  id: string;
  name: string;
  enabled: boolean;
} & (
  | {
      transport: "stdio";
      command: string;
      args: string[];
      env: McpValue[];
      envVars: string[];
      cwd: string;
    }
  | {
      transport: "http";
      url: string;
      bearerTokenEnv: string;
      headers: McpValue[];
      envHeaders: McpValue[];
    }
);

export type McpStatus = "disabled" | "queued" | "connecting" | "refreshing" | "ready" | "error";

export type McpFailureCode =
  | "connection_failed"
  | "missing_environment"
  | "command_not_found"
  | "authentication_required"
  | "connection_timeout"
  | "connection_closed"
  | "invalid_catalog"
  | "refresh_failed";

/** Literal environment/header values are write-only in management snapshots. */
export type McpServerView = McpServerConfig & {
  status: McpStatus;
  toolCount: number;
  error?: McpFailureCode;
};

export class McpConfigError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
