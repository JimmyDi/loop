import type { VoiceCall } from "@loop/coding-agent";
import type { WebSocket } from "ws";

import type { BusinessContext } from "../http/business-context";
import type { VoiceMode } from "../../shared/voice";

export type WebVoiceSpeech = {
  generation: number;
  chunks: Uint8Array[];
  bytes: number;
  sampleRate?: number;
};

export type VoiceAudioWindow = {
  started: number;
  bytes: number;
};

export type WebVoiceCall = {
  id: string;
  owner: BusinessContext;
  clientId: string;
  sessionId?: string;
  mode: VoiceMode;
  call: VoiceCall;
  socket?: WebSocket;
  lease?: ReturnType<typeof setTimeout>;
  expiry?: ReturnType<typeof setTimeout>;
  unsubscribe: () => void;
  muted: boolean;
  readingPaused: boolean;
  generation: number;
  utteranceId: string;
  input: Promise<void>;
  audioBytes: number;
  discarding: boolean;
  speech: Map<string, WebVoiceSpeech>;
  audioWindow: VoiceAudioWindow;
};

export type VoiceConnectionOptions = {
  authenticate: (ticket: unknown) => WebVoiceCall;
  isCurrent: (state: WebVoiceCall) => boolean;
  end: (state: WebVoiceCall) => Promise<void>;
  disconnected: (state: WebVoiceCall) => void;
};
