import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalResult,
  PermissionPreset,
  ModelEffort,
  SessionEvent,
  SessionState,
  PromptTiming,
} from "@loop/coding-agent";

export type { ModelEffort, SessionEvent, SessionState, PromptTiming };
export type { ApprovalDecision, ApprovalRequest, ApprovalResult, PermissionPreset };

export type Message = SessionState["messages"][number];

export type ModelChoice = {
  provider: string;
  providerName?: string;
  id: string;
  name: string;
  efforts?: ModelEffort[];
  input?: ("text" | "image")[];
};
export type ModelSelection = Pick<ModelChoice, "provider" | "id"> & { effort?: ModelEffort };

export type Project = { id: string; name: string; cwd: string; accessible?: boolean };

export type SessionSummary = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  userMessageCount: number;
  title?: string;
  isGenerating?: boolean;
  isWaitingForApproval?: boolean;
  unread?: boolean;
  pinnedAt?: string;
  archived?: boolean;
};

export type ToolView = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: "waiting" | "running" | "success" | "error";
  result?: Extract<Message, { role: "toolResult" }>;
};

export type SessionSnapshot = {
  streamId: string;
  sessionId: string;
  workspaceId: string;
  state: SessionState;
  model: ModelChoice;
  effort?: ModelEffort;
  operation: "idle" | "prompt" | "model" | "flush" | "title" | "permission";
  lastApproval?: Pick<ApprovalResult, "outcome" | "resolvedAt"> & {
    request: Pick<ApprovalRequest, "sessionId" | "requestId" | "toolName">;
  };
  runId?: string;
  requestId?: string;
  draftIndex?: number;
  tools: Record<string, ToolView>;
  commandError?: string;
};

export type FrameBody =
  | { type: "session.snapshot" | "session.state"; snapshot: SessionSnapshot }
  | { type: "run.accepted"; runId: string; requestId: string }
  | { type: "loop.event"; runId: string; event: SessionEvent; messageIndex?: number };

export type Frame = FrameBody & { sessionId: string; streamId: string; seq: number };

export type Cursor = { streamId: string; seq: number };

export type ListChange =
  | { type: "lists.reset" }
  | { type: "sessions.changed" | "projects.changed"; workspaceId: string };

export type ListFrame = ListChange & Cursor;
