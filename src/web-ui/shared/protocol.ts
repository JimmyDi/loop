import type { SessionEvent, SessionState } from "../../coding-agent/index";

export type { SessionEvent, SessionState };

export type Message = SessionState["messages"][number];

export type ModelChoice = { provider: string; id: string; name: string };

export type Project = { id: string; name: string; cwd: string; accessible?: boolean };

export type SessionSummary = {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
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
  operation: "idle" | "prompt" | "model" | "flush";
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

export type DirectoryListing = {
  path: string;
  parent: string;
  home: string;
  entries: { name: string; path: string; hidden: boolean }[];
  truncated: boolean;
};

export type DirectoryCapabilities = { native: boolean; preferred: "native" | "browse" };
