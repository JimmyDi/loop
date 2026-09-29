import type {
  ModelEffort,
  SessionEvent,
  SessionRunTiming,
  SessionState,
} from "../../coding-agent/index";

export type { ModelEffort, SessionEvent, SessionRunTiming, SessionState };

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
  archived?: boolean;
};

export type ToolView = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: "waiting" | "running" | "success" | "error";
  result?: Extract<Message, { role: "toolResult" }>;
};

export type DraftPhase = "thinking" | "thinking-complete" | "text" | "tool";

export type SessionSnapshot = {
  streamId: string;
  sessionId: string;
  workspaceId: string;
  state: SessionState;
  model: ModelChoice;
  effort?: ModelEffort;
  operation: "idle" | "prompt" | "model" | "flush" | "title";
  runId?: string;
  requestId?: string;
  draftIndex?: number;
  draftPhase?: DraftPhase;
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

export type DirectoryListing = {
  path: string;
  parent: string;
  home: string;
  entries: { name: string; path: string; hidden: boolean }[];
  truncated: boolean;
};

export type DirectoryCapabilities = { native: boolean; preferred: "native" | "browse" };
