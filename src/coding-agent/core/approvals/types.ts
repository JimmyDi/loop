import type { ApprovalPolicy } from "../permissions/types";

export type ApprovalDecision = "allowed-once" | "rejected";

export type ApprovalOutcome = ApprovalDecision | "cancelled" | "timed-out" | "unavailable";

export type ApprovalInput = {
  toolCallId: string;
  toolName: string;
  reason: string;
};

export type ApprovalRequest = Readonly<
  ApprovalInput & {
    requestId: string;
    sessionId: string;
    policy: ApprovalPolicy;
    createdAt: number;
    expiresAt: number;
  }
>;

export type ApprovalResult = Readonly<{
  request: ApprovalRequest;
  outcome: ApprovalOutcome;
  resolvedAt: number;
}>;

export type ApprovalResponse = {
  sessionId: string;
  requestId: string;
  decision: ApprovalDecision;
};

export type ApprovalRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** Deliver a request to a host interaction; submit its decision through the session API. */
export type ApprovalHandler = (request: ApprovalRequest) => void | Promise<void>;

export type ApprovalEvent =
  | { type: "approval_requested"; request: ApprovalRequest }
  | { type: "approval_resolved"; result: ApprovalResult };

export const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;
