import type { VoiceInstallCommand, VoiceProfile, VoiceStatus } from "../../../shared/voice";
import type { VoiceSetupActivity } from "./voice-setup-progress-types";

export const voiceSetupActivity = (
  status?: VoiceStatus,
  requested?: VoiceInstallCommand["action"],
): VoiceSetupActivity | undefined => {
  if (requested === "install") return "installing";
  if (requested === "update") return "updating";
  if (requested === "uninstall") return "uninstalling";
  if (
    status?.phase === "installing" ||
    status?.phase === "updating" ||
    status?.phase === "uninstalling"
  )
    return status.phase;
};

export const voiceProfileInstalled = (
  status: VoiceStatus | undefined,
  profile: VoiceProfile,
): boolean => !!status?.installed && (profile === "input" || status.ttsInstalled === true);
