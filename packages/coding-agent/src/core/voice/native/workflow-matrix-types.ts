import type { VoicePlatform } from "../resources/resource-types";

export type VoiceWorkflowTarget = {
  target: VoicePlatform;
  os: string;
};

export type VoiceWorkflowMatrix = {
  targets: string;
  matrix: { include: VoiceWorkflowTarget[] };
};
