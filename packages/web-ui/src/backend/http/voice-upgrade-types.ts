import type { WebSocket } from "ws";

import type { BusinessContext } from "./business-context";

export type VoiceUpgradeHandler = (
  socket: WebSocket,
  callId: string,
  context: BusinessContext,
) => void;

export type VoiceUpgradeAuthorization = (request: Request) => BusinessContext;

export type VoiceUpgradeTracker = (context: BusinessContext, socket: WebSocket) => () => void;

export interface VoiceUpgradeOptions {
  allowVite?: boolean;
}
