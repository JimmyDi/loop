import { afterEach, expect, test, vi } from "vitest";

import { VoiceAudioOutput } from "./voice-audio-output";

afterEach(() => vi.unstubAllGlobals());

test("routes speech through a media stream without connecting it directly to the speakers", async () => {
  const track = { stop: vi.fn() };
  const destination = {
    stream: { getTracks: () => [track] },
    disconnect: vi.fn(),
    connect: vi.fn(),
  };
  const element = { play: vi.fn(async () => {}), pause: vi.fn(), srcObject: null, autoplay: false };
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        return element;
      }
    },
  );
  const context = { createMediaStreamDestination: () => destination } as unknown as AudioContext;
  const output = new VoiceAudioOutput(context);
  expect(element.srcObject).toBe(destination.stream);
  expect(element.autoplay).toBe(true);
  await output.start();
  expect(element.play).toHaveBeenCalledOnce();
  expect(destination.connect).not.toHaveBeenCalled();
  output.close();
  expect(element.pause).toHaveBeenCalledOnce();
  expect(element.srcObject).toBeNull();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(destination.disconnect).toHaveBeenCalledOnce();
});

test("reports blocked playback instead of silently running a call without sound", async () => {
  const error = new Error("playback blocked");
  vi.stubGlobal(
    "Audio",
    class {
      play = vi.fn(async () => {
        throw error;
      });
    },
  );
  const context = {
    createMediaStreamDestination: () => ({ stream: {} }),
  } as unknown as AudioContext;
  await expect(new VoiceAudioOutput(context).start()).rejects.toBe(error);
});
