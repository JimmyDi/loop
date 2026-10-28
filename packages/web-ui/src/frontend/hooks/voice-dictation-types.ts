import type { VoiceControl } from "./voice-hook-types";

export interface VoiceDictationControl {
  active: boolean;
  finishing: boolean;
  samples: number[];
  speaking: boolean;
  begin(): void;
  transcript(text: string, final: boolean, id: string): void;
  energy(value: number): void;
  finish(voice: VoiceControl): Promise<void>;
  discard(voice: VoiceControl): void;
}
