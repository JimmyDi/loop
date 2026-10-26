import type { VoiceMode, VoiceServerEvent } from "../../shared/voice";

export interface VoiceClient {
  mute(value: boolean): void;
  pauseReading(value: boolean): void;
  interrupt(): void;
  finish(): void;
  speak(text: string): void;
  close(): Promise<void>;
}

export interface VoiceClientOptions {
  sessionId?: string;
  mode: VoiceMode;
  signal: AbortSignal;
  waitForClose?: Promise<void>;
  event(event: VoiceServerEvent): void;
  status(status: string): void;
  failed(error: unknown): void;
}
