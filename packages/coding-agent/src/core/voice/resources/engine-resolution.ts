import { join } from "node:path";

import { publishedVoiceEngines, voicePlatform } from "./catalog";
import { validateEngineManifest, engineComponent } from "./engine-manifest";
import { readJson } from "./json-storage";
import { loadReleaseManifest } from "./load-release-manifest";
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
  if (
    platform &&
    !publishedVoiceEngines[platform] &&
    !state.releaseLoading &&
    Date.now() - (state.releaseCheckedAt ?? 0) > 60_000
  ) {
    state.releaseCheckedAt = Date.now();
    state.releaseLoading = loadReleaseManifest()
      .then((release) => {
        state.release = release;
      })
      .catch(() => {
        // Failed discovery must not prevent use of already installed resources.
      })
      .finally(() => {
        state.releaseLoading = undefined;
      });
  }
  await state.releaseLoading;
  const component =
    platform && (state.release?.engines[platform] ?? publishedVoiceEngines[platform]);
  return component
    ? { component, executable: platform === "win32-x64" ? "loop-voice.exe" : "loop-voice" }
    : undefined;
};
