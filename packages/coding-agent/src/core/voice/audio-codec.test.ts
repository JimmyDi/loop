import { expect, test } from "vitest";

import { decodeVoiceSamples } from "./audio-codec";
import { MAX_VOICE_AUDIO_BYTES } from "./protocol-constants";

test("audio decoding rejects malformed, odd-length and oversized PCM", () => {
  expect(() => decodeVoiceSamples("AA==")).toThrow("voice_invalid_audio");
  expect(() => decodeVoiceSamples("AAA!")).toThrow("voice_invalid_audio");
  expect(() =>
    decodeVoiceSamples(Buffer.alloc(MAX_VOICE_AUDIO_BYTES + 2).toString("base64")),
  ).toThrow("voice_invalid_audio");
  expect(decodeVoiceSamples("AAA=")).toEqual(Buffer.alloc(2));
});
