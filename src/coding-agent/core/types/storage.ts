import type { Message } from "@earendil-works/pi-ai";

export type ModelSelection = { provider: string; id: string };

export type SessionHeader = {
  format: "loop-session";
  version: 1;
  id: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  model?: ModelSelection;
};

export type SessionData = { header: SessionHeader; messages: Message[] };

export type SessionInfo = SessionHeader & { path: string; messageCount: number };
