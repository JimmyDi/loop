import { expect, test, vi } from "vitest";

import { VoiceSpeechQueue } from "./voice-speech-queue";

test("narration prefetches one segment during playback without overlapping audio", async () => {
  const done = Promise.withResolvers<void>();
  const send = vi.fn();
  const interrupt = vi.fn();
  const queue = new VoiceSpeechQueue({
    send,
    interrupt,
    current: () => 1,
    play: () => done.promise,
  });
  for (const text of ["first", "outdated", "third", "fourth", "last"]) queue.enqueue(text);
  expect(send.mock.calls).toEqual([["first"]]);
  queue.audio(new ArrayBuffer(2), 0);
  queue.audio(new ArrayBuffer(2), 1);
  expect(send.mock.calls).toEqual([["first"], ["outdated"]]);
  queue.audio(new ArrayBuffer(2), 1);
  expect(send).toHaveBeenCalledTimes(2);
  done.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(send.mock.calls).toEqual([["first"], ["outdated"], ["third"]]);
  queue.failed();
  expect(interrupt).toHaveBeenCalledOnce();
  queue.enqueue("recovered");
  expect(send.mock.calls.at(-1)).toEqual(["recovered"]);
  queue.clear();
});

test("barge-in discards pending narration and ignores late playback completion", async () => {
  const done = Promise.withResolvers<void>();
  const send = vi.fn();
  const queue = new VoiceSpeechQueue({
    send,
    interrupt: vi.fn(),
    current: () => 0,
    play: () => done.promise,
  });
  queue.enqueue("playing");
  queue.enqueue("waiting");
  queue.audio(new ArrayBuffer(2), 0);
  queue.clear();
  done.resolve();
  await Promise.resolve();
  expect(send.mock.calls).toEqual([["playing"], ["waiting"]]);
});

test("synthesis timeout clears waiting speech and invalidates late responses", async () => {
  vi.useFakeTimers();
  const send = vi.fn();
  const interrupt = vi.fn();
  const queue = new VoiceSpeechQueue({
    send,
    interrupt,
    current: () => 0,
    play: () => Promise.resolve(),
  });
  try {
    queue.enqueue("no response");
    queue.enqueue("waiting");
    await vi.advanceTimersByTimeAsync(45_000);
    expect(interrupt).toHaveBeenCalledOnce();
    queue.enqueue("retry");
    expect(send.mock.calls).toEqual([["no response"], ["retry"]]);
  } finally {
    queue.clear();
    vi.useRealTimers();
  }
});

test("reads all segments in order without dropping an extended execution backlog", async () => {
  const send = vi.fn();
  const queue = new VoiceSpeechQueue({
    send,
    current: () => 0,
    interrupt: vi.fn(),
    play: async () => {},
  });
  const text = "进度更新。".repeat(20) + "长句".repeat(200);
  queue.enqueue(text);
  for (
    let count = 0;
    count < 30 && send.mock.calls.map(([part]) => part).join("") !== text;
    count++
  ) {
    queue.audio(new ArrayBuffer(2), 0);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(send.mock.calls.map(([part]) => part).join("")).toBe(text);
  expect(send.mock.calls.length).toBeGreaterThan(3);
  queue.clear();
});
