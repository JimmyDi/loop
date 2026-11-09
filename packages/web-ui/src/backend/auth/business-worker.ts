import type { BusinessHandler } from "../http/business-context";
import type { VoiceUpgradeHandler } from "../http/voice-upgrade-types";

export type BusinessWorker = {
  handle: BusinessHandler;
  voice: VoiceUpgradeHandler;
  revokeVoice(principal: string): Promise<void>;
};
