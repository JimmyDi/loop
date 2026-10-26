import type { RawData } from "ws";

import type { WebVoiceCall } from "./call-types";
import { completeVoiceSpeech, sendVoiceEvent } from "./call-events";

export const acceptVoiceAudio = (state: WebVoiceCall, data: RawData): void => {
  if (state.muted || state.discarding) return;
  const bytes = Buffer.isBuffer(data)
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : Buffer.concat(data);
  if (!bytes.length || bytes.length % 2 || bytes.length > 32_768)
    throw new Error("voice_invalid_audio");
  if (Date.now() - state.audioWindow.started >= 1_000)
    state.audioWindow = { started: Date.now(), bytes: 0 };
  state.audioWindow.bytes += bytes.length;
  if (state.audioWindow.bytes > 96_000 || state.audioBytes + bytes.length > 64_000)
    throw new Error("voice_audio_overloaded");
  state.audioBytes += bytes.length;
  state.input = state.input
    .then(() => state.call.writeAudio(bytes))
    .catch(() => {
      sendVoiceEvent(state, { type: "error", code: "voice_audio_overloaded" });
      state.socket?.close(1013, "voice_audio_overloaded");
    })
    .finally(() => {
      state.audioBytes -= bytes.length;
    });
};

export const controlVoiceCall = (state: WebVoiceCall, value: unknown, close: () => void): void => {
  if (!value || typeof value !== "object" || !("type" in value))
    throw new Error("voice_invalid_control");
  const event = value as Record<string, unknown>;
  if (event.type === "configure") {
    if (typeof event.muted !== "boolean" || typeof event.readingPaused !== "boolean")
      throw new Error("voice_invalid_control");
    const reset = event.muted && !state.muted;
    state.muted = event.muted;
    state.readingPaused = event.readingPaused;
    if (state.readingPaused) {
      state.call.cancelSpeech();
      state.speech.clear();
    }
    if (reset) {
      state.discarding = true;
      state.utteranceId = crypto.randomUUID();
      state.input = state.input
        .then(() => state.call.discardInput())
        .catch(() => {
          state.socket?.close(1011, "voice_transcription_failed");
        })
        .finally(() => {
          state.discarding = false;
        });
    }
  } else if (event.type === "finish") {
    state.input = state.input
      .then(() => state.call.endInput())
      .catch(() => {
        sendVoiceEvent(state, { type: "error", code: "voice_transcription_failed" });
        state.socket?.close(1011, "voice_transcription_failed");
      });
  } else if (event.type === "interrupt") {
    if (!Number.isSafeInteger(event.generation) || (event.generation as number) < state.generation)
      throw new Error("voice_invalid_control");
    state.generation = event.generation as number;
    state.call.cancelSpeech();
    state.speech.clear();
  } else if (event.type === "speak") {
    if (
      typeof event.text !== "string" ||
      !event.text.trim() ||
      event.text.length > 600 ||
      !Number.isSafeInteger(event.generation)
    )
      throw new Error("voice_invalid_control");
    if (state.readingPaused || event.generation !== state.generation) return;
    if (state.speech.size >= 4) throw new Error("voice_speech_overloaded");
    const requestId = crypto.randomUUID();
    const speech = { generation: state.generation, chunks: [], bytes: 0 };
    state.speech.set(requestId, speech);
    void state.call
      .synthesize(event.text, { requestId })
      .then(() => completeVoiceSpeech(state, requestId))
      .catch(() => {
        if (state.speech.get(requestId) === speech && !state.readingPaused)
          sendVoiceEvent(state, { type: "error", code: "voice_synthesis_failed" });
      })
      .finally(() => state.speech.delete(requestId));
  } else if (event.type === "close") close();
  else throw new Error("voice_invalid_control");
};
