import { afterEach, expect, test, vi } from "vitest";

import { startCapture } from "./capture";
import type { VoiceCapture } from "./capture-types";
import type { VoiceCaptureOptions } from "./capture-types";
import { startVoice } from "./client";
import { voiceCommand } from "./request";
import { connectVoice } from "./socket";

vi.mock("./capture", () => ({ startCapture: vi.fn() }));
vi.mock("./request", () => ({ voiceCommand: vi.fn() }));
vi.mock("./socket", () => ({ connectVoice: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();
});

test("call connection music stops on readiness and stays silent during reconnect", async () => {
  vi.useFakeTimers();
  const note = {
    frequency: { value: 0 },
    connect: vi.fn((value) => value),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => ({ ...note })),
    createGain: () => ({
      gain: {
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  } as unknown as AudioContext;
  vi.mocked(startCapture).mockResolvedValue({
    context,
    playbackDestination: { media: true } as unknown as AudioNode,
    close: vi.fn(async () => {}),
    mute: vi.fn(),
    discard: vi.fn(),
    finish: vi.fn(async () => {}),
  });
  vi.mocked(voiceCommand).mockResolvedValue({ callId: "call", ticket: "ticket", expiresAt: 123 });
  vi.mocked(connectVoice).mockReturnValue({
    send: vi.fn(),
    pcm: vi.fn(() => true),
    close: vi.fn(),
  });
  const controller = new AbortController();
  const client = await startVoice({
    signal: controller.signal,
    mode: "conversation",
    event: vi.fn(),
    status: vi.fn(),
    failed: vi.fn(),
  });
  expect(context.createOscillator).toHaveBeenCalledOnce();
  expect(note.connect).toHaveBeenCalled();
  const socket = vi.mocked(connectVoice).mock.calls[0]![0];
  vi.advanceTimersByTime(1200);
  expect(context.createOscillator).toHaveBeenCalledTimes(4);
  socket.ready();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(2000);
  expect(context.createOscillator).toHaveBeenCalledTimes(4);
  socket.disconnected();
  expect(vi.getTimerCount()).toBe(0);
  expect(context.createOscillator).toHaveBeenCalledTimes(4);
  controller.abort();
  expect(vi.getTimerCount()).toBe(0);
  await client.close();
});

test("Stop flushes captured audio before requesting final transcription and keeps late text", async () => {
  let captureOptions!: VoiceCaptureOptions;
  const flushed = Promise.withResolvers<void>();
  const send = vi.fn();
  const pcm = vi.fn(() => true);
  const event = vi.fn();
  const close = vi.fn(async () => {});
  vi.mocked(startCapture).mockImplementation(async (options) => {
    captureOptions = options;
    return {
      context: {} as AudioContext,
      close,
      mute: vi.fn(),
      discard: vi.fn(),
      finish: async () => {
        await flushed.promise;
        captureOptions.frame(new ArrayBuffer(16), 0.1);
      },
    };
  });
  vi.mocked(voiceCommand).mockResolvedValue({ callId: "call", ticket: "ticket", expiresAt: 123 });
  vi.mocked(connectVoice).mockReturnValue({ send, pcm, close: vi.fn() });
  const client = await startVoice({
    signal: new AbortController().signal,
    mode: "test",
    event,
    status: vi.fn(),
    failed: vi.fn(),
  });
  const socketOptions = vi.mocked(connectVoice).mock.calls[0]![0];
  socketOptions.ready();
  send.mockClear();
  const stopping = client.finish("final-request");
  expect(send).not.toHaveBeenCalled();
  flushed.resolve();
  await stopping;
  expect(pcm).toHaveBeenCalledOnce();
  expect(pcm.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]!);
  expect(send).toHaveBeenCalledWith({ type: "finish", requestId: "final-request" });
  socketOptions.event({
    type: "transcript",
    text: "Complete last phrase",
    final: true,
    utteranceId: "last",
  });
  expect(event).toHaveBeenCalledWith(expect.objectContaining({ text: "Complete last phrase" }));
  expect(close).not.toHaveBeenCalled();
  await client.close();
});

test("engine startup overlaps microphone preparation", async () => {
  const capture = Promise.withResolvers<VoiceCapture>();
  vi.mocked(startCapture).mockReturnValue(capture.promise);
  vi.mocked(voiceCommand).mockResolvedValue({ callId: "call", ticket: "ticket", expiresAt: 123 });
  const options = {
    signal: new AbortController().signal,
    mode: "dictation" as const,
    event: vi.fn(),
    status: vi.fn(),
    failed: vi.fn(),
  };
  const pending = startVoice(options);
  await Promise.resolve();
  expect(startCapture).toHaveBeenCalledOnce();
  expect(voiceCommand).toHaveBeenCalledWith("/voice/calls", expect.anything(), expect.anything());
  expect(connectVoice).not.toHaveBeenCalled();
  const close = vi.fn(async () => {});
  capture.resolve({
    context: {} as AudioContext,
    close,
    mute: vi.fn(),
    discard: vi.fn(),
    finish: vi.fn(async () => {}),
  });
  const client = await pending;
  expect(connectVoice).toHaveBeenCalledOnce();
  await client.close();
  expect(close).toHaveBeenCalledOnce();
});

test("microphone rejection closes a backend call already prepared in parallel", async () => {
  const capture = Promise.withResolvers<VoiceCapture>();
  vi.mocked(startCapture).mockReturnValue(capture.promise);
  vi.mocked(voiceCommand).mockResolvedValue({
    callId: "prepared",
    ticket: "ticket",
    expiresAt: 123,
  });
  const pending = startVoice({
    signal: new AbortController().signal,
    mode: "dictation",
    event: vi.fn(),
    status: vi.fn(),
    failed: vi.fn(),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  capture.reject(new Error("microphone_denied"));
  await expect(pending).rejects.toThrow("microphone_denied");
  expect(voiceCommand).toHaveBeenLastCalledWith("/voice/calls/prepared/close", expect.anything());
  expect(connectVoice).not.toHaveBeenCalled();
});
