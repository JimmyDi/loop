import type { VoiceMode, VoiceServerEvent } from "../../shared/voice";

export interface VoiceClient {
  mute(value: boolean): void;
  pauseReading(value: boolean): void;
  interrupt(): void;
  finish(requestId?: string): void | Promise<void>;
  speak(text: string): void;
  close(): Promise<void>;
}

export interface VoiceClientOptions {
  energy?(value: number): void;
  playbackProgress?(value: number): void;
  sessionId?: string;
  mode: VoiceMode;
  synthesis?: boolean;
  signal: AbortSignal;
  waitForClose?: Promise<void>;
  event(event: VoiceServerEvent): void;
  status(status: string): void;
  failed(error: unknown): void;
}
