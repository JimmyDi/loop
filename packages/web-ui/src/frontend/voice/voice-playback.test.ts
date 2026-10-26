import { expect, test, vi } from "vitest";

import { VoicePlayback } from "./voice-playback";

test("barge-in invalidates a decoding generation and stops every queued source", async () => {
  let resolve!: (value: AudioBuffer) => void;
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    decodeAudioData: vi.fn(
      () =>
        new Promise<AudioBuffer>((done) => {
          resolve = done;
        }),
    ),
    createBufferSource: vi.fn(() => source),
  } as unknown as AudioContext;
  const activity = vi.fn();
  const playback = new VoicePlayback(context, activity);
  playback.play(new ArrayBuffer(2), 0);
  await Promise.resolve();
  expect(playback.interrupt()).toBe(1);
  resolve({ duration: 1 } as AudioBuffer);
  await Promise.resolve();
  await Promise.resolve();
  expect(context.createBufferSource).not.toHaveBeenCalled();
  playback.play(new ArrayBuffer(2), 1);
  await Promise.resolve();
  await Promise.resolve();
  resolve({ duration: 1 } as AudioBuffer);
  await Promise.resolve();
  await Promise.resolve();
  expect(source.start).toHaveBeenCalled();
  playback.interrupt();
  expect(source.stop).toHaveBeenCalledOnce();
  expect(source.disconnect).toHaveBeenCalledOnce();
});
