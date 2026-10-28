export interface VoiceInputSamplerProps {
  samples: number[];
  dense?: boolean;
  active: boolean;
  connecting: boolean;
  recording: boolean;
  remaining?: number;
  onDiscard(): void;
  onFinish(): void;
}
