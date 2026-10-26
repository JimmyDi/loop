import type { UseQueryResult } from "@tanstack/react-query";

import type { VoiceInstallCommand, VoiceStatus } from "../../shared/voice";

export interface VoiceSettingsControl {
  query: UseQueryResult<VoiceStatus, Error>;
  execute(value: VoiceInstallCommand): Promise<void>;
  pending: boolean;
  requested?: VoiceInstallCommand["action"];
  error?: unknown;
}
