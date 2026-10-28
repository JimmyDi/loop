import { expect, test, vi } from "vitest";

import { VoiceInputCompletion } from "./voice-input-completion";

test("finalization waits past the old deadline for its own completion acknowledgement", async () => {
  vi.useFakeTimers();
  const completion = new VoiceInputCompletion();
  try {
    const send = vi.fn();
    const done = vi.fn();
    const pending = completion.wait(send).then(done);
    expect(completion.wait(send)).toBeInstanceOf(Promise);
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000);
    completion.complete("unrelated-request");
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    completion.complete(send.mock.calls[0]![0]);
    await pending;
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    completion.cancel();
    vi.useRealTimers();
  }
});

test("engine failures reject finalization while explicit discard releases its waiter", async () => {
  const completion = new VoiceInputCompletion();
  const failed = completion.wait(() => {});
  const assertion = expect(failed).rejects.toThrow("voice_transcription_failed");
  completion.fail(new Error("voice_transcription_failed"));
  await assertion;
  const cancelled = completion.wait(() => {});
  completion.cancel();
  await expect(cancelled).resolves.toBeUndefined();
});

test("finalization timeout reports failure instead of pretending transcription completed", async () => {
  vi.useFakeTimers();
  try {
    const completion = new VoiceInputCompletion();
    const assertion = expect(completion.wait(() => {})).rejects.toThrow("voice_engine_timeout");
    await vi.advanceTimersByTimeAsync(65_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
