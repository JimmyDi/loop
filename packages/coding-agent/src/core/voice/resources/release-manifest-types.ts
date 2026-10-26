import type { VoiceComponent, VoicePlatform } from "./resource-types";

export type VoiceReleaseManifest = {
  schemaVersion: 1;
  protocolVersion: 1;
  version: string;
  engines: Partial<Record<VoicePlatform, VoiceComponent>>;
  models: Partial<Record<string, VoiceComponent>>;
};
