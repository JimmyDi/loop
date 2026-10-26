import type { VoiceProfile } from "../../shared/voice";

export interface VoiceSetupPreference {
  profile: VoiceProfile;
  verifiedSignature?: string;
}

export interface VoiceSetupState extends VoiceSetupPreference {
  deviceId: string;
  setProfile(profile: VoiceProfile): void;
  setDevice(id: string): void;
  verify(signature: string): void;
  clearVerification(): void;
}
