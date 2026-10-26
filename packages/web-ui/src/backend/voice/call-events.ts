import type { VoiceEvent } from "@loop/coding-agent";
import { WebSocket } from "ws";

import type { VoiceServerEvent } from "../../shared/voice";
import type { WebVoiceCall } from "./call-types";
import { pcmWave } from "./wav";

export const sendVoiceEvent = (state: WebVoiceCall, event: VoiceServerEvent): void => {
  const socket = state.socket;
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 2_000_000) {
    socket.close(1013, "voice_playback_overloaded");
    return;
  }
  socket.send(JSON.stringify(event));
};

export const completeVoiceSpeech = (state: WebVoiceCall, requestId: string): void => {
  const speech = state.speech.get(requestId);
  if (!speech || speech.generation !== state.generation || state.readingPaused) return;
  if (!speech.sampleRate || !speech.bytes) throw new Error("voice_synthesis_empty");
  const socket = state.socket;
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 2_000_000) {
    socket.close(1013, "voice_playback_overloaded");
    return;
  }
  const wav = pcmWave(Buffer.concat(speech.chunks), speech.sampleRate);
  socket.send(
    JSON.stringify({
      type: "audio",
      generation: speech.generation,
      sampleRate: speech.sampleRate,
      format: "wav",
    } satisfies VoiceServerEvent),
  );
  socket.send(wav);
};

export const forwardVoiceEvent = (state: WebVoiceCall, event: VoiceEvent): void => {
  if (event.type === "transcript") {
    if (state.discarding || state.muted) return;
    sendVoiceEvent(state, { ...event, type: "transcript", utteranceId: state.utteranceId });
    if (event.final) state.utteranceId = crypto.randomUUID();
  } else if (event.type === "audio") {
    const speech = state.speech.get(event.requestId);
    if (!speech || speech.generation !== state.generation || state.readingPaused) return;
    if (
      speech.bytes + event.samples.length > 4_000_000 ||
      (speech.sampleRate !== undefined && speech.sampleRate !== event.sampleRate)
    ) {
      state.call.cancelSpeech();
      state.speech.clear();
      sendVoiceEvent(state, { type: "error", code: "voice_synthesis_failed" });
      return;
    }
    speech.sampleRate = event.sampleRate;
    speech.chunks.push(event.samples);
    speech.bytes += event.samples.length;
  } else if (event.type === "error") sendVoiceEvent(state, { type: "error", code: event.code });
  else if (event.type === "speech")
    sendVoiceEvent(state, { type: "status", status: event.active ? "listening" : "transcribing" });
  else if (event.type === "state" && event.state === "closed") {
    sendVoiceEvent(state, { type: "error", code: "voice_engine_closed" });
    state.socket?.close(1011, "voice_engine_closed");
  }
};
