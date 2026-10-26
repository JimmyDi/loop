import { sourceVoiceModels, VOICE_ENGINE_VERSION } from "./catalog";
import { componentHash, safeResourcePath } from "./resource-paths";
import { voiceReleaseBase } from "./release-version";
import type { VoiceReleaseManifest } from "./release-manifest-types";
import type { VoiceComponent } from "./resource-types";

export const validateReleaseManifest = (input: unknown, version: string): VoiceReleaseManifest => {
  const value = input as VoiceReleaseManifest;
  const invalid = (): never => {
    throw new Error("voice_release_manifest_invalid");
  };
  if (
    !value ||
    value.schemaVersion !== 1 ||
    value.protocolVersion !== 1 ||
    value.version !== version ||
    !value.engines ||
    !value.models
  )
    return invalid();
  for (const [key, component] of [
    ...Object.entries(value.engines),
    ...Object.entries(value.models),
  ]) {
    const item = component as VoiceComponent;
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
      !Array.isArray(item.files) ||
      !item.files.length ||
      item.files.length > 64 ||
      typeof item.name !== "string" ||
      typeof item.license !== "string" ||
      !item.archive ||
      item.archive.url !== voiceReleaseBase(version) + item.id + ".tar.gz" ||
      !Number.isSafeInteger(item.archive.bytes) ||
      item.archive.bytes <= 0 ||
      item.archive.bytes > 512 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(item.archive.sha256) ||
      item.files.some(
        (file) =>
          !file ||
          !safeResourcePath(file.path) ||
          !Number.isSafeInteger(file.bytes) ||
          file.bytes <= 0 ||
          file.bytes > 512 * 1024 * 1024 ||
          !/^[a-f0-9]{64}$/.test(file.sha256),
      ) ||
      new Set(item.files.map((file) => file.path)).size !== item.files.length ||
      item.archive.expandedBytes !== item.files.reduce((sum, file) => sum + file.bytes, 0)
    )
      return invalid();
    if (item.kind === "engine") {
      if (
        !["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"].includes(key) ||
        item.id !== "loop-voice-" + key ||
        item.version !== VOICE_ENGINE_VERSION ||
        value.models[key] ||
        !item.files.some(
          (file) =>
            file.path === (key === "win32-x64" ? "loop-voice.exe" : "loop-voice") &&
            file.executable === true,
        ) ||
        item.files.some(
          (file) =>
            file.executable &&
            file.path !== (key === "win32-x64" ? "loop-voice.exe" : "loop-voice"),
        )
      )
        return invalid();
    } else {
      const pinned = sourceVoiceModels.find((model) => model.id === key);
      if (
        !pinned ||
        item.id !== key ||
        item.kind !== pinned.kind ||
        item.version !== pinned.version ||
        value.engines[key as keyof typeof value.engines] ||
        componentHash(item) !== componentHash(pinned)
      )
        return invalid();
    }
    // Only the validated archive URL may be used; manifests cannot introduce file URLs.
    item.files = item.files.map((file) => ({ ...file, url: "" }));
  }
  if (
    !Object.keys(value.engines).length ||
    sourceVoiceModels.some((model) => !value.models[model.id])
  )
    return invalid();
  return value;
};
