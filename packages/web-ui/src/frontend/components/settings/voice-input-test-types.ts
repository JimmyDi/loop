import type { VoiceTestState } from "./voice-test-types";

export interface VoiceInputTestProps {
  disabled: boolean;
  onStart?(): void;
  onStateChange?(state: VoiceTestState): void;
}
