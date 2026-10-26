import type { VoiceProfile, VoiceStatus } from "../../shared/voice";

export const voiceSetupSignature = (
  status: VoiceStatus | undefined,
  profile: VoiceProfile,
  deviceId: string,
): string | undefined => {
  if (
    !status?.supported ||
    !status.installed ||
    status.engineAvailable === false ||
    status.phase !== "idle" ||
    status.error ||
    !status.version?.trim() ||
    !status.components?.length ||
    (profile === "conversation" && status.ttsInstalled !== true)
  )
    return;

  const requiredKinds =
    profile === "conversation" ? ["engine", "asr", "vad", "tts"] : ["engine", "asr", "vad"];
  if (
    requiredKinds.some(
      (kind) =>
        !status.components?.some((component) => component.kind === kind) ||
        status.components.some((component) => component.kind === kind && !component.installed),
    ) ||
    status.components.some((component) => !component.id.trim() || !component.version.trim())
  )
    return;

  const components = status.components
    .map((component) => [component.kind, component.id, component.version, component.installed])
    .sort((left, right) => {
      const first = JSON.stringify(left);
      const second = JSON.stringify(right);
      return first < second ? -1 : first > second ? 1 : 0;
    });

  return JSON.stringify([
    profile,
    deviceId,
    status.version,
    status.ttsInstalled === true,
    components,
  ]);
};

export const voiceSetupReady = (
  status: VoiceStatus | undefined,
  profile: VoiceProfile,
  deviceId: string,
  verifiedSignature: string | undefined,
): boolean => {
  const signature = voiceSetupSignature(status, profile, deviceId);
  return signature !== undefined && signature === verifiedSignature;
};
