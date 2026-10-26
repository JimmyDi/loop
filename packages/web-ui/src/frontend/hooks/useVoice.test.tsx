import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { VoiceClient, VoiceClientOptions } from "../voice/client-types";
import { useVoice } from "./useVoice";

const runtime = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../voice/client", () => ({ startVoice: runtime.start }));

test("dictation finishes its last phrase before close, deduplicates final text and rejects old-session callbacks", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const transcripts = vi.fn();
  let options: any;
  const close = vi.fn(async () => {});
  const finish = vi.fn(() =>
    options.event({ type: "transcript", text: "final text", final: true, utteranceId: "one" }),
  );
  runtime.start.mockImplementation(async (value) => {
    options = value;
    return {
      close,
      finish,
      mute: vi.fn(),
      interrupt: vi.fn(),
      speak: vi.fn(),
      pauseReading: vi.fn(),
    };
  });
  try {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useVoice({ sessionId, transcript: transcripts }),
      { initialProps: { sessionId: "first" } },
    );
    await act(async () => {
      await result.current.start("dictation");
    });
    act(() =>
      options.event({ type: "transcript", text: "partial", final: false, utteranceId: "one" }),
    );
    await act(async () => {
      await result.current.endInput();
    });
    expect(finish).toHaveBeenCalledOnce();
    expect(transcripts.mock.calls.map((args) => args[0])).toEqual(["partial", "final text"]);
    expect(close).toHaveBeenCalledOnce();
    expect(result.current.text).toBe("final text");
    await act(async () => {
      await result.current.start("conversation");
    });
    act(() => {
      options.event({ type: "transcript", text: "once", final: true, utteranceId: "two" });
      options.event({ type: "transcript", text: "once", final: true, utteranceId: "two" });
    });
    expect(transcripts.mock.calls.filter((args) => args[0] === "once")).toHaveLength(1);
    rerender({ sessionId: "second" });
    act(() =>
      options.event({ type: "transcript", text: "stale", final: true, utteranceId: "old" }),
    );
    expect(transcripts.mock.calls.some((args) => args[0] === "stale")).toBe(false);
    expect(options.signal.aborted).toBe(true);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("switching sessions aborts an outstanding microphone start and closes its late client", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const pending = Promise.withResolvers<any>();
  const close = vi.fn(async () => {});
  let signal: AbortSignal | undefined;
  runtime.start.mockImplementation((options) => {
    signal = options.signal;
    return pending.promise;
  });
  try {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useVoice({ sessionId, transcript: vi.fn() }),
      { initialProps: { sessionId: "first" } },
    );
    let starting: Promise<void> | undefined;
    act(() => {
      starting = result.current.start("dictation");
    });
    rerender({ sessionId: "second" });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve({ close });
      await starting;
    });
    expect(close).toHaveBeenCalledOnce();
    expect(result.current.mode).toBeUndefined();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("mute and spoken-reply pause while connecting apply before the late client can deliver speech", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  const pending = Promise.withResolvers<VoiceClient>();
  const transcript = vi.fn();
  const active: VoiceClient = {
    mute: vi.fn(),
    pauseReading: vi.fn(),
    interrupt: vi.fn(),
    finish: vi.fn(),
    speak: vi.fn(),
    close: vi.fn(async () => {}),
  };
  let options: VoiceClientOptions | undefined;
  runtime.start.mockImplementation((value: VoiceClientOptions) => {
    options = value;
    return pending.promise;
  });
  try {
    const { result } = renderHook(() => useVoice({ sessionId: "voice", transcript }));
    let starting: Promise<void> | undefined;
    act(() => {
      starting = result.current.start("conversation");
    });
    act(() => {
      result.current.mute(true);
      result.current.pauseReading(true);
      options?.event({
        type: "transcript",
        text: "Ignored speech",
        final: true,
        utteranceId: "one",
      });
    });
    expect(transcript).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve(active);
      await starting;
    });
    expect(result.current.muted).toBe(true);
    expect(result.current.readingPaused).toBe(true);
    expect(active.mute).toHaveBeenCalledExactlyOnceWith(true);
    expect(active.pauseReading).toHaveBeenCalledExactlyOnceWith(true);
    act(() => {
      options?.event({
        type: "transcript",
        text: "Still ignored",
        final: true,
        utteranceId: "two",
      });
      result.current.mute(false);
      result.current.pauseReading(false);
      options?.event({
        type: "transcript",
        text: "Resumed speech",
        final: true,
        utteranceId: "three",
      });
    });
    expect(active.mute).toHaveBeenLastCalledWith(false);
    expect(active.pauseReading).toHaveBeenLastCalledWith(false);
    expect(transcript).toHaveBeenCalledExactlyOnceWith(
      "Resumed speech",
      true,
      "three",
      "conversation",
    );
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["connecting", "connecting-cancelled", "listening"] as const)(
  "pagehide pauses a %s call and returning requires an explicit restart",
  async (phase) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const pending = Promise.withResolvers<VoiceClient>();
    const active: VoiceClient = {
      mute: vi.fn(),
      pauseReading: vi.fn(),
      interrupt: vi.fn(),
      finish: vi.fn(),
      speak: vi.fn(),
      close: vi.fn(async () => {}),
    };
    const transcript = vi.fn();
    let options: VoiceClientOptions | undefined;
    runtime.start.mockReset().mockImplementation((value: VoiceClientOptions) => {
      options = value;
      return pending.promise;
    });
    try {
      const { result } = renderHook(() => useVoice({ sessionId: "voice", transcript }));
      let starting: Promise<void> | undefined;
      act(() => {
        starting = result.current.start("conversation");
      });
      if (phase === "listening") {
        await act(async () => {
          pending.resolve(active);
          await starting;
          options?.status("listening");
          options?.event({
            type: "transcript",
            text: "Unfinished speech",
            final: false,
            utteranceId: "one",
          });
        });
        expect(result.current.text).toBe("Unfinished speech");
      }
      const initialOptions = options;
      act(() => window.dispatchEvent(new window.Event("pagehide")));
      expect(initialOptions?.signal.aborted).toBe(true);
      expect(result.current.mode).toBe("conversation");
      expect(result.current.status).toBe("paused");
      expect(result.current.text).toBe("");
      if (phase !== "listening") {
        await act(async () => {
          if (phase === "connecting-cancelled") pending.reject(new Error("Cancelled startup"));
          else pending.resolve(active);
          await starting;
        });
      }
      expect(active.close).toHaveBeenCalledTimes(phase === "connecting-cancelled" ? 0 : 1);
      expect(result.current.error).toBeUndefined();
      act(() => {
        window.dispatchEvent(new window.Event("pageshow"));
        initialOptions?.status("listening");
        initialOptions?.event({
          type: "transcript",
          text: "Late speech",
          final: true,
          utteranceId: "late",
        });
      });
      expect(result.current.status).toBe("paused");
      expect(result.current.text).toBe("");
      expect(transcript).toHaveBeenCalledTimes(phase === "listening" ? 1 : 0);
      expect(runtime.start).toHaveBeenCalledOnce();

      runtime.start.mockImplementation(async (value: VoiceClientOptions) => {
        value.status("listening");
        return active;
      });
      await act(async () => result.current.start("conversation"));
      expect(runtime.start).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe("listening");
      expect(result.current.error).toBeUndefined();
    } finally {
      cleanup();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
