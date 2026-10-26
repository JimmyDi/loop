export interface VoiceTestStepProps {
  ready: boolean;
  speechReady: boolean;
  verified?: boolean;
  onVerified?(): void;
  onReset?(): void;
}
