import { sourceVoiceModels } from "../resources/catalog";
import type { VoiceComponent, VoicePlatform } from "../resources/resource-types";
import { releaseVoicePlatforms } from "./release-assets";
import type { VoiceReleaseCatalog } from "./release-target-types";

export const selectReleaseTargets = (args: readonly string[]): VoicePlatform[] => {
  if (!args.length) return ["darwin-arm64"];
  if (args.length !== 2 || args[0] !== "--targets" || !args[1])
    throw new Error("Use --targets <comma-separated-platforms> to select voice release targets");
  const targets = args[1].split(",");
  if (targets.some((target) => !releaseVoicePlatforms.includes(target as VoicePlatform)))
    throw new Error("Unknown voice release target");
  if (new Set(targets).size !== targets.length) throw new Error("Duplicate voice release target");
  return targets as VoicePlatform[];
};

export const selectedMetadataFiles = (
  names: readonly string[],
  targets: readonly VoicePlatform[],
): string[] => {
  const expected = new Set([
    "reviewed-model-assets.json",
    ...targets.map((target) => "reviewed-engine-" + target + ".json"),
  ]);
  return names.filter((name) => expected.has(name)).sort();
};

export const selectReleaseCatalog = (
  components: readonly VoiceComponent[],
  targets: readonly VoicePlatform[],
): VoiceReleaseCatalog => {
  const engines: Partial<Record<VoicePlatform, VoiceComponent>> = {};
  const models: Record<string, VoiceComponent> = {};
  for (const component of components) {
    if (component.kind === "engine") {
      const platform = targets.find((target) => component.id === "loop-voice-" + target);
      if (!platform) continue;
      if (engines[platform]) throw new Error("Duplicate voice release component");
      engines[platform] = component;
      continue;
    }
    if (!sourceVoiceModels.some((model) => model.id === component.id))
      throw new Error("Unknown voice release model");
    if (models[component.id]) throw new Error("Duplicate voice release component");
    models[component.id] = component;
  }
  const missing = [
    ...targets.filter((target) => !engines[target]),
    ...sourceVoiceModels.filter((model) => !models[model.id]).map((model) => model.id),
  ];
  if (missing.length)
    throw new Error("Missing required voice release components: " + missing.join(", "));
  return { engines, models };
};
