// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { VoiceClientOptions } from "../voice/client-types";
import { startVoice } from "../voice/client";
import { useVoice } from "./useVoice";
import { useVoiceInputSession } from "./useVoiceInputSession";

vi.mock("../voice/client", () => ({ startVoice: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

test.each([false, true])(
  "Stop waits for transcription with keepInputOpen=%s",
  async (keepInputOpen) => {
    vi.useFakeTimers();
    let connection!: VoiceClientOptions;
    const close = vi.fn(async () => {});
    const finish = vi.fn();
    vi.mocked(startVoice).mockImplementation(async (options) => {
      connection = options;
      return {
        close,
        finish,
        mute: vi.fn(),
        pauseReading: vi.fn(),
        interrupt: vi.fn(),
        speak: vi.fn(),
      };
    });
    const complete = vi.fn();
    const { result } = renderHook(() => {
      const input = useVoiceInputSession({ complete });
      const voice = useVoice({ transcript: input.transcript, keepInputOpen });
      return { input, voice };
    });
    await act(async () => {
      result.current.input.begin();
      await result.current.voice.start("dictation");
      connection.status("transcribing");
    });
    let stopped!: Promise<void>;
    act(() => {
      stopped = result.current.input.finish(result.current.voice);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      connection.event({
        type: "transcript",
        text: "First phrase",
        final: true,
        utteranceId: "one",
      });
    });
    expect(close).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(result.current.input.finishing).toBe(true);
    await act(async () => {
      connection.event({
        type: "transcript",
        text: "Last phrase",
        final: true,
        utteranceId: "two",
      });
      connection.event({ type: "input-completed", requestId: finish.mock.calls[0]![0] });
      await stopped;
    });
    expect(complete).toHaveBeenCalledExactlyOnceWith("First phrase Last phrase");
    expect(close).toHaveBeenCalledTimes(keepInputOpen ? 0 : 1);
    expect(result.current.input.active).toBe(false);
  },
);
