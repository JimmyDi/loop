import type { Message } from "@earendil-works/pi-ai";
import type { ModelEffort } from "../models/model-effort";
import type { SessionTitle } from "../titles/types";
import type { SessionRunTiming } from "../run-timing";
import type { PermissionPreset } from "../permissions/types";
import type { RuntimeContextSnapshot } from "../runtime-context";

export type ModelSelection = { provider: string; id: string; effort?: ModelEffort };

export type SessionHeader = {
  format: "loop-session";
  version: 1 | 2;
  id: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  unread?: boolean;
  model?: ModelSelection;
  title?: SessionTitle;
  runTimings?: SessionRunTiming[];
  permissionPreset?: PermissionPreset;
  runtimeContexts?: RuntimeContextSnapshot[];
};

export type SessionData = { header: SessionHeader; messages: Message[] };

export type SessionInfo = SessionHeader & {
  path: string;
  messageCount: number;
  userMessageCount: number;
};
