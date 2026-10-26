import { expect, test } from "vitest";

import { MAX_VOICE_FRAME_BYTES } from "./protocol-constants";
import { VoiceFrameDecoder } from "./voice-frame-decoder";

test("frame decoding preserves split UTF-8 and coalesced JSONL records", () => {
  const decoder = new VoiceFrameDecoder();
  const frame = { v: 1, id: "input", type: "transcript", text: "检查代码", final: true };
  const encoded = Buffer.from(JSON.stringify(frame) + "\n");
  const split = encoded.indexOf(Buffer.from("检")) + 1;
  expect(decoder.push(encoded.subarray(0, split))).toEqual([]);
  expect(decoder.push(encoded.subarray(split))).toEqual([frame]);
  expect(
    decoder.push(
      Buffer.from('{"v":1,"id":"a","type":"ready"}\n{"v":1,"id":"b","type":"completed"}\n'),
    ),
  ).toHaveLength(2);
  decoder.finish();
});

test("frame decoding rejects oversized buffers and incomplete final records", () => {
  const decoder = new VoiceFrameDecoder();
  expect(() => decoder.push(Buffer.alloc(MAX_VOICE_FRAME_BYTES + 1, 32))).toThrow(
    "voice_frame_too_large",
  );
  const partial = new VoiceFrameDecoder();
  partial.push(Buffer.from("{"));
  expect(() => partial.finish()).toThrow("voice_incomplete_frame");
});
