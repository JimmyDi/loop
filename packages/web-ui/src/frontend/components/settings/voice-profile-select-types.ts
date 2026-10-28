import type { VoiceProfile } from "../../../shared/voice";

export interface VoiceProfileSelectProps {
  profile: VoiceProfile;
  disabled: boolean;
  onChange(profile: VoiceProfile): void;
}
