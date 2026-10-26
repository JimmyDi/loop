import type { VoiceClientEvent, VoiceConnection, VoiceServerEvent } from "../../shared/voice";

export interface VoiceSocket {
  send(event: VoiceClientEvent): void;
  pcm(bytes: ArrayBuffer): boolean;
  close(): void;
}

export interface VoiceSocketOptions {
  connection: VoiceConnection;
  clientId: string;
  signal: AbortSignal;
  ready(): void;
  event(event: VoiceServerEvent): void;
  audio(bytes: ArrayBuffer, generation: number): void;
  disconnected(): void;
  failed(error: unknown): void;
}
