import { join } from "node:path";

import { publishedVoiceEngines, voicePlatform } from "./catalog";
import { validateEngineManifest, engineComponent } from "./engine-manifest";
import { readJson } from "./json-storage";
import type { VoiceEngineSelection, VoiceResourceOperationState } from "./resource-types";

export const resolveVoiceEngine = async (
  directory: string,
  state: VoiceResourceOperationState,
): Promise<VoiceEngineSelection | undefined> => {
  const manifest = await readJson(join(directory, "local-engine.json"));
  if (manifest) {
    try {
      const value = validateEngineManifest(manifest);
      return { component: engineComponent(value), executable: value.executable };
    } catch {
      state.error = "voice_engine_manifest_invalid";
    }
  }
  const platform = voicePlatform();
  const component = platform && publishedVoiceEngines[platform];
  return component
    ? { component, executable: platform === "win32-x64" ? "loop-voice.exe" : "loop-voice" }
    : undefined;
};
