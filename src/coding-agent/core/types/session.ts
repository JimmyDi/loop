import type { Api, AssistantMessage, Message, Model } from "@earendil-works/pi-ai";

import type { AgentEvent, AgentTool } from "../../../agent";
import type { ModelRuntime } from "../model-runtime";
import type { SessionManager } from "../session-manager";

export type SessionEvent = AgentEvent | { type: "agent_settled" };

export type SessionEventListener = (event: SessionEvent) => void | Promise<void>;

export type SessionState = {
  messages: Message[];
  draft?: AssistantMessage;
  isRunning: boolean;
  hasPendingSave: boolean;
  outcome: "idle" | "success" | "error" | "cancelled";
  error?: string;
  listenerErrors: string[];
};

export type SessionOptions = {
  model: Model<Api>;
  modelRuntime: ModelRuntime;
  sessionManager: SessionManager;
  systemPrompt: string;
  tools: AgentTool[];
  maxTurns?: number;
};
