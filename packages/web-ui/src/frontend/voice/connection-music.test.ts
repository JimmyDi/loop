import { afterEach, expect, test, vi } from "vitest";

import { ConnectionMusic } from "./connection-music";

afterEach(() => vi.useRealTimers());

test("connection melody loops until stopped and disconnects every node immediately", () => {
  vi.useFakeTimers();
  const notes: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const volumes: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator: () => {
      const note = {
        frequency: { value: 0 },
        connect: vi.fn((value) => value),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      notes.push(note);
      return note;
    },
    createGain: () => {
      const volume = {
        gain: {
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      volumes.push(volume);
      return volume;
    },
  } as unknown as AudioContext;
  const music = new ConnectionMusic(context);
  music.start();
  music.start();
  vi.advanceTimersByTime(800);
  expect(notes).toHaveLength(3);
  expect(vi.getTimerCount()).toBe(1);
  music.stop();
  expect(vi.getTimerCount()).toBe(0);
  for (const note of notes) {
    expect(note.stop).toHaveBeenCalledTimes(2);
    expect(note.disconnect).toHaveBeenCalledOnce();
  }
  for (const volume of volumes) expect(volume.disconnect).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(2000);
  expect(notes).toHaveLength(3);
});
