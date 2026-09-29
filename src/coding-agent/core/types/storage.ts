import type { Message } from "@earendil-works/pi-ai";
import type { ModelEffort } from "../models/model-effort";
import type { SessionTitle } from "../titles/types";
import type { SessionRunTiming } from "../run-timing";

export type ModelSelection = { provider: string; id: string; effort?: ModelEffort };

export type SessionHeader = {
  format: "loop-session";
  version: 1;
  id: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  model?: ModelSelection;
  title?: SessionTitle;
  runTimings?: SessionRunTiming[];
};

export type SessionData = { header: SessionHeader; messages: Message[] };

export type SessionInfo = SessionHeader & {
  path: string;
  messageCount: number;
  userMessageCount: number;
};
