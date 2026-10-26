import type { VoiceProfile } from "../../../shared/voice";

export interface VoiceProfileStepProps {
  profile: VoiceProfile;
  disabled: boolean;
  complete: boolean;
  loading: boolean;
  onChange(profile: VoiceProfile): void;
}
