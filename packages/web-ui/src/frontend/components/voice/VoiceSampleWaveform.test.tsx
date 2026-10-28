import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { VoiceSampleWaveform } from "./VoiceSampleWaveform";

test("idle waveform is dotted and samples extend from the right", () => {
  const idle = renderToStaticMarkup(<VoiceSampleWaveform samples={[]} active={false} />);
  expect(idle.match(/<line /g)).toHaveLength(80);
  expect(idle.match(/y1="15.75"/g)).toHaveLength(80);
  const active = renderToStaticMarkup(<VoiceSampleWaveform samples={[0.3]} active />);
  expect(active).toContain('x1="238.5" x2="238.5" y1="2" y2="30"');
});

test("quiet speech has visible amplitude while background noise stays dotted", () => {
  const noise = renderToStaticMarkup(<VoiceSampleWaveform samples={[0.001]} active />);
  expect(noise).toContain('x1="238.5" x2="238.5" y1="15.75"');
  const speech = renderToStaticMarkup(<VoiceSampleWaveform samples={[0.014]} active />);
  const y1 = Number(speech.match(/x1="238.5" x2="238.5" y1="([^"]+)"/)?.[1]);
  expect(y1).toBeLessThan(15.75);
  expect(y1).toBeGreaterThan(8.875);
});

test.each([false, true])(
  "volume levels stay distinct before the unchanged peak, dense=%s",
  (dense) => {
    const levels = [0.002, 0.006, 0.014, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.6];
    const heights = levels.map((level) => {
      const html = renderToStaticMarkup(
        <VoiceSampleWaveform samples={[level]} active dense={dense} />,
      );
      const lines = [...html.matchAll(/y1="([^"]+)" y2="([^"]+)"/g)];
      const last = lines.at(-1)!;
      return Number(last[2]) - Number(last[1]);
    });
    for (let index = 1; index < heights.length - 1; index++) {
      expect(heights[index]).toBeGreaterThan(heights[index - 1]!);
    }
    expect(heights[6]).toBeLessThan(22);
    expect(heights.at(-2)).toBe(28);
    expect(heights.at(-1)).toBe(28);
  },
);
