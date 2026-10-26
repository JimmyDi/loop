import { expect, test } from "vitest";

import { PcmResampler } from "./pcm-resampler";

test("resampling keeps duration across uneven blocks", () => {
  const resampler = new PcmResampler(48_000);
  const output: number[] = [];
  for (let offset = 0; offset < 48_000; offset += 128) {
    output.push(...resampler.push(new Float32Array(Math.min(128, 48_000 - offset)).fill(0.5)));
  }
  expect(output.length).toBe(16_000);
  expect(output.every((value) => value === 16384)).toBe(true);
});

test("resampler retains interpolation at fractional block boundaries and clamps samples", () => {
  const input = Float32Array.from({ length: 4410 }, (_, index) => Math.sin(index / 10) * 2);
  const whole = new PcmResampler(44_100).push(input);
  const chunks = new PcmResampler(44_100);
  const output = [...chunks.push(input.slice(0, 137)), ...chunks.push(input.slice(137))];
  expect(output).toEqual([...whole]);
  expect(Math.max(...output)).toBe(32767);
  expect(Math.min(...output)).toBe(-32768);
});
