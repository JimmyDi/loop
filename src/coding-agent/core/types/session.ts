import type { Api, AssistantMessage, Message, Model } from "@earendil-works/pi-ai";

import type { AgentEvent, AgentTool } from "../../../agent";
import type { ModelRuntime } from "../model-runtime";
import type { SessionManager } from "../session-manager";
import type { ModelEffort } from "../models/model-effort";
import type { SessionTitle, SessionTitleOptions } from "../titles/types";
import type { SessionRunTiming } from "../run-timing";

export type SessionEvent =
  | AgentEvent
  | { type: "agent_settled" }
  | { type: "run_timing"; timing: SessionRunTiming }
  | { type: "session_title"; title: SessionTitle; error?: string };

export type SessionEventListener = (event: SessionEvent) => void | Promise<void>;

export type SessionState = {
  messages: Message[];
  draft?: AssistantMessage;
  isRunning: boolean;
  hasPendingSave: boolean;
  outcome: "idle" | "success" | "error" | "cancelled";
  error?: string;
  listenerErrors: string[];
  title?: SessionTitle;
  titleError?: string;
  runTimings?: SessionRunTiming[];
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
};
