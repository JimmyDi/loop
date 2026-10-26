import { expect, test, vi } from "vitest";

import { VoiceSpeechQueue } from "./voice-speech-queue";

test("narration bounds its backlog and waits for complete playback before synthesizing again", async () => {
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
  expect(send).toHaveBeenCalledTimes(1);
  done.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(send.mock.calls).toEqual([["first"], ["third"]]);
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
  expect(send).toHaveBeenCalledOnce();
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
