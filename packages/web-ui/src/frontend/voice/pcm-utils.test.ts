import { expect, test } from "vitest";

import { pcmBytes, pcmEnergy } from "./pcm-utils";

test("PCM bytes use little-endian signed samples and energy is normalized RMS", () => {
  expect([...new Uint8Array(pcmBytes(Int16Array.from([-32768, 32767])))]).toEqual([
    0, 128, 255, 127,
  ]);
  expect(pcmEnergy(Int16Array.from([16384, -16384]))).toBeCloseTo(0.5);
});
