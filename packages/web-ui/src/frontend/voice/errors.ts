export const voiceErrorKey = (error: unknown): string => {
  const code =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? ((error as Error & { code?: string }).code ?? "") + " " + error.message
        : "";
  if (/engine_asset_unavailable|engine_unavailable|resource_asset_unavailable/.test(code))
    return "voice.engineUnavailable";
  if (/platform_unsupported/.test(code)) return "voice.unsupported";
  if (/integrity|checksum/.test(code)) return "voice.integrityFailed";
  if (/download|network/.test(code)) return "voice.downloadFailed";
  if (/not_installed|resource_missing|tts_unavailable/.test(code)) return "voice.resourcesMissing";
  if (/busy|in_use|active_call/.test(code)) return "voice.resourcesBusy";
  if (/NotAllowed|PermissionDenied/.test(code)) return "voice.permissionDenied";
  return "voice.failed";
};
