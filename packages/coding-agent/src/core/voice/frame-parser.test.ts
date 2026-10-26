import { expect, test } from "vitest";

import { parseVoiceFrame } from "./frame-parser";

test("frame parsing enforces the protocol version and audio sample rate", () => {
  expect(() => parseVoiceFrame('{"v":2,"id":"a","type":"ready"}')).toThrow("voice_invalid_frame");
  expect(() =>
    parseVoiceFrame('{"v":1,"id":"a","type":"audio","samples":"AAA=","sampleRate":1}'),
  ).toThrow("voice_invalid_frame");
  expect(parseVoiceFrame('{"v":1,"id":"a","type":"ready"}')).toEqual({
    v: 1,
    id: "a",
    type: "ready",
  });
});
