import type { VoiceComponent, VoicePlatform } from "./resource-types";

// Replace only after reviewing and publishing the prepared, verified release assets.
export const publishedVoiceEngines: Partial<Record<VoicePlatform, VoiceComponent>> = {};

export const publishedVoiceModels: Partial<Record<string, VoiceComponent>> = {};
