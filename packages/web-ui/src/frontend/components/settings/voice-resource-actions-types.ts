import type { VoiceInstallCommand, VoiceProfile, VoiceStatus } from "../../../shared/voice";

export interface VoiceResourceActionsProps {
  status?: VoiceStatus;
  profile: VoiceProfile;
  disabled: boolean;
  pending: boolean;
  active: boolean;
  loaded: boolean;
  cancellable?: boolean;
  execute(value: VoiceInstallCommand): Promise<void>;
}
