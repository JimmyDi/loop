import { decodeVoiceSamples } from "./audio-codec";
import { MAX_VOICE_FRAME_BYTES } from "./protocol-constants";
import { validVoiceId } from "./protocol-identifiers";
import type { VoiceFrame } from "./protocol-types";

export const parseVoiceFrame = (line: string): VoiceFrame => {
  if (Buffer.byteLength(line) > MAX_VOICE_FRAME_BYTES) throw new Error("voice_frame_too_large");
  let frame: Record<string, unknown>;
  try {
    frame = JSON.parse(line);
  } catch {
    throw new Error("voice_invalid_frame");
  }
  if (!frame || typeof frame !== "object" || frame.v !== 1 || !validVoiceId(frame.id))
    throw new Error("voice_invalid_frame");
  switch (frame.type) {
    case "ready":
    case "completed":
      break;
    case "speech":
      if (typeof frame.active !== "boolean") throw new Error("voice_invalid_frame");
      break;
    case "transcript":
      if (typeof frame.text !== "string" || typeof frame.final !== "boolean")
        throw new Error("voice_invalid_frame");
      break;
    case "audio":
      decodeVoiceSamples(frame.samples);
      if (
        !Number.isSafeInteger(frame.sampleRate) ||
        Number(frame.sampleRate) < 8000 ||
        Number(frame.sampleRate) > 192000
      )
        throw new Error("voice_invalid_frame");
      break;
    case "error":
      if (typeof frame.code !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(frame.code))
        throw new Error("voice_invalid_frame");
      break;
    default:
      throw new Error("voice_invalid_frame");
  }
  return frame as VoiceFrame;
};
