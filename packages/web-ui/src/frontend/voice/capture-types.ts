export interface VoiceCapture {
  context: AudioContext;
  mute(value: boolean): void;
  discard(): void;
  close(): Promise<void>;
}

export interface VoiceCaptureOptions {
  frame(bytes: ArrayBuffer, energy: number): void;
  interrupted(): void;
  signal: AbortSignal;
}
