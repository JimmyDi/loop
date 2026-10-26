import { expect, test } from "vitest";

import { encodeVoiceCommand } from "./command-encoder";

test("command encoding rejects empty synthesis and emits one JSONL record", () => {
  expect(() => encodeVoiceCommand({ v: 1, id: "a", type: "synthesize", text: " " })).toThrow(
    "voice_invalid_text",
  );
  expect(encodeVoiceCommand({ v: 1, id: "a", type: "end" })).toBe(
    '{"v":1,"id":"a","type":"end"}\n',
  );
});
