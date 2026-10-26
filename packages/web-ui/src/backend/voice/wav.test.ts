import { expect, test } from "vitest";

import { pcmWave } from "./wav";

test("PCM16 is wrapped in a bounded mono WAV with the original sample bytes", () => {
  const samples = Uint8Array.from([1, 0, 255, 127, 0, 128]);
  const wave = Buffer.from(pcmWave(samples, 24_000));
  expect(wave.toString("ascii", 0, 4)).toBe("RIFF");
  expect(wave.readUInt32LE(24)).toBe(24_000);
  expect(wave.readUInt32LE(40)).toBe(samples.length);
  expect(wave.subarray(44)).toEqual(Buffer.from(samples));
  expect(() => pcmWave(new Uint8Array(1), 24_000)).toThrow("voice_audio_invalid");
  expect(() => pcmWave(samples, 0)).toThrow("voice_audio_invalid");
});
