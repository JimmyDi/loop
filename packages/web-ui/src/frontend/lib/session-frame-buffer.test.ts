import { expect, test } from "vitest";

import type { Frame, SessionEvent } from "../../shared/protocol";
import { sessionFrameBuffer } from "./session-frame-buffer";

const frame = (seq: number, type = "message_update"): Frame => ({
  sessionId: "example",
  streamId: "stream",
  seq,
  type: "loop.event",
  runId: "run",
  event: { type, message: { role: "assistant", content: [] } } as SessionEvent,
});

test("draft bursts commit once per paint and lifecycle events drain earlier drafts in order", () => {
  let scheduled: (() => void) | undefined;
  const commits: number[][] = [];
  const buffer = sessionFrameBuffer(
    (frames) => {
      commits.push(frames.map((frame) => frame.seq));
      return true;
    },
    () => {
      throw new Error("unexpected rejection");
    },
    (callback) => {
      scheduled = callback;
      return 1;
    },
    () => {},
  );
  buffer.push(frame(1));
  buffer.push(frame(2));
  expect(commits).toEqual([]);
  scheduled!();
  expect(commits).toEqual([[1, 2]]);
  buffer.push(frame(3));
  buffer.push(frame(4, "message_end"));
  expect(commits).toEqual([
    [1, 2],
    [3, 4],
  ]);
  buffer.push(frame(5));
  buffer.dispose();
  scheduled!();
  expect(commits).toHaveLength(2);
});

test("bounded pending drafts flush without a paint and rejection is reported", () => {
  let rejected = 0;
  let length = 0;
  const buffer = sessionFrameBuffer(
    (frames) => {
      length = frames.length;
      return false;
    },
    () => rejected++,
    () => 1,
    () => {},
  );
  for (let seq = 1; seq <= 128; seq++) buffer.push(frame(seq));
  expect(length).toBe(128);
  expect(rejected).toBe(1);
});
