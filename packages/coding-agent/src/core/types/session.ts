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
import type { ContextBudget } from "../context-budget";
import type { McpManager } from "../mcp/mcp-manager";
import type { SkillManager } from "../skills/skill-manager";
import type { LoadedSkill } from "../skills/types";

export type SessionEvent =
  | (AgentEvent & { toolDisplayName?: string })
  | ApprovalEvent
  | { type: "agent_settled" }
  | { type: "prompt_timing"; timing: PromptTiming }
  | { type: "context_budget"; budget: ContextBudget }
  | { type: "skills_loaded"; userTurn: number; skills: LoadedSkill[] }
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
  contextBudget?: ContextBudget;
  permissionPreset?: PermissionPreset;
  pendingApprovals?: ApprovalRequest[];
  skillLoads?: Array<{ userTurn: number; skills: LoadedSkill[] }>;
};

export type SessionOptions = {
  model: Model<Api>;
  modelRuntime: ModelRuntime;
  sessionManager: SessionManager;
  systemPrompt: string;
  tools: AgentTool[];
  mcpManager?: McpManager;
  skillManager?: SkillManager;
  ownsSkillManager?: boolean;
  maxTurns?: number;
  effort?: ModelEffort;
  title?: SessionTitleOptions;
  permissionPolicy?: PermissionPolicy;
};
