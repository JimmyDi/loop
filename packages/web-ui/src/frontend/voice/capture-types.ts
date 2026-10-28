export interface VoiceCapture {
  context: AudioContext;
  playbackDestination?: AudioNode;
  mute(value: boolean): void;
  discard(): void;
  finish(): Promise<void>;
  close(): Promise<void>;
}

export interface VoiceCaptureOptions {
  frame(bytes: ArrayBuffer, energy: number): void;
  interrupted(): void;
  signal: AbortSignal;
}
