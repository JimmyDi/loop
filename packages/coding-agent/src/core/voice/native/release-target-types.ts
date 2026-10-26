import type { VoiceComponent, VoicePlatform } from "../resources/resource-types";

export type VoiceReleaseCatalog = {
  engines: Partial<Record<VoicePlatform, VoiceComponent>>;
  models: Record<string, VoiceComponent>;
};
