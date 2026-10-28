import type { VoiceMode } from "../../shared/voice";

export interface VoiceOptions {
  keepInputOpen?: boolean;
  synthesis?: boolean;
  energy?(value: number): void;
  playbackProgress?(value: number): void;
  sessionId?: string;
  transcript(text: string, final: boolean, id: string, mode: VoiceMode): void;
}

export interface VoiceControl {
  mode?: VoiceMode;
  status: string;
  text: string;
  error?: unknown;
  muted: boolean;
  readingPaused: boolean;
  start(mode: VoiceMode): Promise<void>;
  stop(): Promise<void>;
  speak(text: string): void;
  finish(): void;
  endInput(): Promise<void>;
  interrupt(): void;
  mute(value: boolean): void;
  pauseReading(value: boolean): void;
}
