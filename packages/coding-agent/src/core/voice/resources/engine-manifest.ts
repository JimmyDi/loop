import { VOICE_ENGINE_LICENSE, VOICE_ENGINE_VERSION, voicePlatform } from "./catalog";
import { safeResourcePath } from "./resource-paths";
import type { VoiceComponent, VoiceEngineManifest } from "./resource-types";

export const validateEngineManifest = (value: unknown): VoiceEngineManifest => {
  if (!value || typeof value !== "object") throw new Error("voice_engine_manifest_invalid");
  const manifest = value as VoiceEngineManifest;
  if (
    manifest.version !== 1 ||
    manifest.protocolVersion !== 1 ||
    manifest.engineVersion !== VOICE_ENGINE_VERSION ||
    manifest.sherpaVersion !== "2.0.0" ||
    manifest.platform !== voicePlatform() ||
    !safeResourcePath(manifest.executable) ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > 64 ||
    manifest.files.some(
      (file) =>
        !file ||
        !safeResourcePath(file.path) ||
        !/^[a-f0-9]{64}$/.test(file.sha256) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes <= 0 ||
        file.bytes > 512 * 1024 * 1024,
    ) ||
    new Set(manifest.files.map((file) => file.path)).size !== manifest.files.length ||
    !manifest.files.some((file) => file.path === manifest.executable)
  )
    throw new Error("voice_engine_manifest_invalid");
  return manifest;
};

export const engineComponent = (manifest: VoiceEngineManifest): VoiceComponent => ({
  id: "loop-voice-" + manifest.platform,
  name: "Loop local voice engine",
  kind: "engine",
  version: manifest.engineVersion,
  license: VOICE_ENGINE_LICENSE,
  files: manifest.files.map((file) => ({
    ...file,
    url: "",
    executable: file.path === manifest.executable,
  })),
});
