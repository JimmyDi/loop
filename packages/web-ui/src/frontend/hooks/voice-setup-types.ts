import type { VoiceProfile } from "../../shared/voice";

export interface VoiceSetupControl {
  profile: VoiceProfile;
  deviceId: string;
  verifiedSignature?: string;
  signature?: string;
  complete: boolean;
  setProfile(profile: VoiceProfile): void;
  setDevice(id: string): void;
  verify(): void;
  clearVerification(): void;
}
