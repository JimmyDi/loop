import type { Message } from "@earendil-works/pi-ai";
import type { ModelEffort } from "../models/model-effort";
import type { SessionTitle } from "../titles/types";
import type { PermissionPreset } from "../permissions/types";
import type { RuntimeContextSnapshot } from "../runtime-context";

import type { PromptTiming } from "../prompt-timing";

export type ModelSelection = { provider: string; id: string; effort?: ModelEffort };

export type SessionHeader = {
  format: "loop-session";
  version: 2;
  id: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  unread?: boolean;
  pinnedAt?: string;
  model?: ModelSelection;
  title?: SessionTitle;
  permissionPreset: PermissionPreset;
  runtimeContexts?: RuntimeContextSnapshot[];
  promptTimings?: PromptTiming[];
};

export type SessionData = { header: SessionHeader; messages: Message[] };

export type SessionInfo = SessionHeader & {
  path: string;
  messageCount: number;
  userMessageCount: number;
};
