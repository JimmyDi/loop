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

test("playback progress follows the audio clock and stops updating after completion", async () => {
  vi.useFakeTimers();
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    decodeAudioData: async () => ({ duration: 4 }),
    createBufferSource: () => source,
  };
  const progress = vi.fn();
  const playback = new VoicePlayback(context as unknown as AudioContext, vi.fn(), progress);
  try {
    const completed = playback.play(new ArrayBuffer(2), 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(progress).toHaveBeenLastCalledWith(0);
    context.currentTime = 2;
    await vi.advanceTimersByTimeAsync(50);
    expect(progress).toHaveBeenLastCalledWith(0.5);
    source.onended?.();
    await completed;
    expect(progress).toHaveBeenLastCalledWith(1);
    const count = progress.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(progress).toHaveBeenCalledTimes(count);
  } finally {
    playback.interrupt();
    vi.useRealTimers();
  }
});

test("uses the media playback destination for speech and disconnects on interruption", async () => {
  const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    decodeAudioData: async () => ({ duration: 1 }),
    createBufferSource: () => source,
  } as unknown as AudioContext;
  const destination = {} as AudioNode;
  const playback = new VoicePlayback(context, vi.fn(), undefined, destination);
  const playing = playback.play(new ArrayBuffer(2), 0);
  await vi.waitFor(() => expect(source.start).toHaveBeenCalled());
  expect(source.connect).toHaveBeenCalledWith(destination);
  playback.interrupt();
  await playing;
  expect(source.stop).toHaveBeenCalledOnce();
});
