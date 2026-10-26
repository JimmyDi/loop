import type { VoiceProfile } from "../../../shared/voice";
import type { VoiceSettingsControl } from "../../hooks/voice-settings-types";

export interface VoiceResourceStepProps {
  settings: VoiceSettingsControl;
  profile: VoiceProfile;
}
