import type { Api, AssistantMessage, Message, Model } from "@earendil-works/pi-ai";

import type { AgentEvent, AgentTool } from "@loop/agent";
import type { ModelRuntime } from "../model-runtime";
import type { SessionManager } from "../session-manager";
import type { ModelEffort } from "../models/model-effort";
import type { SessionTitle, SessionTitleOptions } from "../titles/types";
import type { PermissionPolicy } from "../permissions/policy";
import type { PermissionPreset } from "../permissions/types";
import type { ApprovalEvent, ApprovalRequest } from "../approvals/types";

import type { PromptTiming } from "../prompt-timing";

export type SessionEvent =
  | AgentEvent
  | ApprovalEvent
  | { type: "agent_settled" }
  | { type: "prompt_timing"; timing: PromptTiming }
  | { type: "permission_changed"; permissionPreset: PermissionPreset }
  | { type: "session_title"; title: SessionTitle; error?: string };

export type SessionEventListener = (event: SessionEvent) => void | Promise<void>;

export type SessionState = {
  messages: Message[];
  draft?: AssistantMessage;
  isRunning: boolean;
  hasPendingSave: boolean;
  unread?: boolean;
  outcome: "idle" | "success" | "error" | "cancelled";
  error?: string;
  listenerErrors: string[];
  title?: SessionTitle;
  titleError?: string;
  promptTimings?: PromptTiming[];
  permissionPreset?: PermissionPreset;
  pendingApprovals?: ApprovalRequest[];
};

export type SessionOptions = {
  model: Model<Api>;
  modelRuntime: ModelRuntime;
  sessionManager: SessionManager;
  systemPrompt: string;
  tools: AgentTool[];
  maxTurns?: number;
  effort?: ModelEffort;
  title?: SessionTitleOptions;
  permissionPolicy?: PermissionPolicy;
};
