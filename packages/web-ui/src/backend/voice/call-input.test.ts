import type { VoiceCall } from "@loop/coding-agent";
import { WebSocket } from "ws";
import { expect, test, vi } from "vitest";

import { forwardVoiceEvent } from "./call-events";
import { controlVoiceCall } from "./call-input";
import type { WebVoiceCall } from "./call-types";

test("finish acknowledges only after queued audio and final transcription complete", async () => {
  const audio = Promise.withResolvers<void>();
  const transcription = Promise.withResolvers<void>();
  const sent: string[] = [];
  const endInput = vi.fn(() => transcription.promise);
  const state = {
    input: audio.promise,
    call: { endInput },
    socket: {
      readyState: WebSocket.OPEN,
      bufferedAmount: 0,
      send: (value: string) => sent.push(value),
    },
  } as unknown as WebVoiceCall;
  controlVoiceCall(state, { type: "finish", requestId: "final-input" }, vi.fn());
  expect(endInput).not.toHaveBeenCalled();
  audio.resolve();
  await Promise.resolve();
  expect(endInput).toHaveBeenCalledOnce();
  expect(sent).toEqual([]);
  transcription.resolve();
  await state.input;
  expect(sent.map((value) => JSON.parse(value))).toEqual([
    { type: "input-completed", requestId: "final-input" },
  ]);
});

test("native synthesis chunks become one complete WAV and cancellation discards stale chunks", async () => {
  const sent: Array<string | Uint8Array> = [];
  const pending = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  const call = {
    synthesize: vi.fn((_text: string, { requestId }: { requestId: string }) => {
      const completion = Promise.withResolvers<void>();
      pending.set(requestId, completion);
      return completion.promise;
    }),
    cancelSpeech: vi.fn(),
  } as unknown as VoiceCall;
  const state = {
    id: "call",
    call,
    generation: 0,
    readingPaused: false,
    speech: new Map(),
    socket: {
      readyState: WebSocket.OPEN,
      bufferedAmount: 0,
      send: (value: string | Uint8Array) => sent.push(value),
    },
  } as unknown as WebVoiceCall;
  const synthesize = () => {
    controlVoiceCall(state, { type: "speak", generation: state.generation, text: "test" }, vi.fn());
    return [...pending.keys()].at(-1)!;
  };
  const chunk = (requestId: string, samples: number[]) =>
    forwardVoiceEvent(state, {
      callId: state.id,
      type: "audio",
      requestId,
      samples: Uint8Array.from(samples),
      sampleRate: 24000,
    });
  const first = synthesize();
  chunk(first, [1, 0]);
  chunk(first, [2, 0]);
  expect(sent).toEqual([]);
  pending.get(first)!.resolve();
  await vi.waitFor(() => expect(sent).toHaveLength(2));
  expect(JSON.parse(sent[0] as string)).toEqual({
    type: "audio",
    generation: 0,
    sampleRate: 24000,
    format: "wav",
  });
  expect(Buffer.from(sent[1] as Uint8Array).subarray(44)).toEqual(Buffer.from([1, 0, 2, 0]));
  const old = synthesize();
  chunk(old, [3, 0]);
  controlVoiceCall(state, { type: "interrupt", generation: 1 }, vi.fn());
  chunk(old, [4, 0]);
  pending.get(old)!.resolve();
  await vi.waitFor(() => expect(state.speech.size).toBe(0));
  expect(sent).toHaveLength(2);
  expect(call.cancelSpeech).toHaveBeenCalledOnce();
});
