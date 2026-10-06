import type { ApprovalPolicy } from "../permissions/types";

export type ApprovalDecision = "allowed-once" | "allowed-session" | "rejected";

export type ApprovalOutcome = ApprovalDecision | "cancelled" | "timed-out" | "unavailable";

export type ApprovalOperation =
  | {
      kind: "mcp-tool";
      workspaceRoot: string;
      arguments: Record<string, unknown>;
      serverName: string;
      toolName: string;
      transport: "stdio" | "http";
      permissionMode?: never;
    }
  | {
      kind: "file-write";
      /** Display tier covering the canonical target; approval still permits only this replacement. */
      permissionMode?: "workspace-write" | "danger-full-access";
      arguments: Record<string, unknown>;
      workspaceRoot: string;
      targetPath: string;
      beforeSha256: string | null;
      afterSha256: string;
    }
  | {
      kind: "shell-unrestricted";
      arguments: Record<string, unknown>;
      workspaceRoot: string;
      filesystem: "host";
      network: "host";
      environment: "host";
    };

export type ApprovalInput = {
  toolCallId: string;
  toolName: string;
  reason: string;
  operation?: ApprovalOperation;
};

export type ApprovalRequest = Readonly<
  ApprovalInput & {
    requestId: string;
    sessionId: string;
    policy: ApprovalPolicy;
    allowSession?: boolean;
    createdAt: number;
    /** Null means the request waits until a decision or cancellation. */
    expiresAt: number | null;
  }
>;

export type ApprovalResult = Readonly<{
  request: ApprovalRequest;
  outcome: ApprovalOutcome;
  resolvedAt: number;
  source?: "session-grant" | "full-access";
}>;

export type ApprovalResponse = {
  sessionId: string;
  requestId: string;
  decision: ApprovalDecision;
};

export type ApprovalRequestOptions = {
  signal?: AbortSignal;
  /** Host-owned MCP tool identity, never accepted from an approval response or model arguments. */
  mcp?: { lifetime: AbortSignal; toolKey: string };
  /** Omit or use null to wait indefinitely; positive values opt into a deadline. */
  timeoutMs?: number | null;
};

/** Deliver a request to a host interaction; submit its decision through the session API. */
export type ApprovalHandler = (request: ApprovalRequest) => void | Promise<void>;

export type ApprovalEvent =
  | { type: "approval_requested"; request: ApprovalRequest }
  | { type: "approval_resolved"; result: ApprovalResult };

export const DEFAULT_APPROVAL_TIMEOUT_MS = null;
