import { parseVoiceFrame } from "./frame-parser";
import { MAX_VOICE_FRAME_BYTES } from "./protocol-constants";
import type { VoiceFrame } from "./protocol-types";

export class VoiceFrameDecoder {
  private buffered = Buffer.alloc(0);

  push = (chunk: Uint8Array): VoiceFrame[] => {
    const frames: VoiceFrame[] = [];
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset);
      const end = newline < 0 ? chunk.length : newline;
      if (this.buffered.length + end - offset > MAX_VOICE_FRAME_BYTES)
        throw new Error("voice_frame_too_large");
      this.buffered = Buffer.concat([this.buffered, chunk.subarray(offset, end)]);
      if (newline < 0) break;
      frames.push(parseVoiceFrame(this.buffered.toString("utf8")));
      this.buffered = Buffer.alloc(0);
      offset = newline + 1;
    }
    return frames;
  };

  finish = (): void => {
    if (this.buffered.length) throw new Error("voice_incomplete_frame");
  };
}
