import { MAX_VOICE_AUDIO_BYTES } from "./protocol-constants";

export const decodeVoiceSamples = (value: unknown): Buffer => {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > Math.ceil(MAX_VOICE_AUDIO_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  )
    throw new Error("voice_invalid_audio");
  const samples = Buffer.from(value, "base64");
  if (
    !samples.length ||
    samples.length % 2 ||
    samples.length > MAX_VOICE_AUDIO_BYTES ||
    samples.toString("base64") !== value
  )
    throw new Error("voice_invalid_audio");
  return samples;
};
