export interface VoiceSpeechQueueOptions {
  send(text: string): void;
  play(bytes: ArrayBuffer, generation: number): Promise<void>;
  current(): number;
  interrupt(): void;
}
