export type VoiceTestState = "idle" | "loading" | "verified" | "failed";

export interface VoiceTestProps {
  disabled: boolean;
  speechDisabled?: boolean;
  onStateChange?(state: VoiceTestState): void;
}
