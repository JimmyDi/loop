import { useCallback, useEffect, useRef, useState } from "react";

import type { VoiceMode, VoiceServerEvent } from "../../shared/voice";
import { startVoice } from "../voice/client";
import type { VoiceClient } from "../voice/client-types";
import type { VoiceControl, VoiceOptions } from "./voice-hook-types";

export const useVoice = (options: VoiceOptions): VoiceControl => {
  const [mode, setMode] = useState<VoiceMode>();
  const [status, setStatus] = useState("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<unknown>();
  const [muted, setMuted] = useState(false);
  const [readingPaused, setReadingPaused] = useState(false);
  const client = useRef<VoiceClient | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const preferences = useRef({ muted: false, readingPaused: false });
  const callbacks = useRef(options);
  const currentMode = useRef<VoiceMode | undefined>(undefined);
  const finals = useRef(new Set<string>());
  const finalWait = useRef<(() => void) | undefined>(undefined);
  callbacks.current = options;
  const stop = useCallback(async () => {
    finalWait.current?.();
    controller.current?.abort();
    controller.current = undefined;
    const active = client.current;
    client.current = undefined;
    currentMode.current = undefined;
    setMode(undefined);
    setStatus("idle");
    await active?.close();
  }, []);
  const start = async (next: VoiceMode) => {
    const closing = stop();
    const request = new AbortController();
    controller.current = request;
    currentMode.current = next;
    setMode(next);
    setStatus("connecting");
    setError(undefined);
    setText("");
    setMuted(false);
    setReadingPaused(false);
    preferences.current = { muted: false, readingPaused: false };
    finals.current.clear();
    const capture = startVoice({
      sessionId: options.sessionId,
      mode: next,
      signal: request.signal,
      waitForClose: closing,
      status: (value) => {
        if (!request.signal.aborted) setStatus(value);
      },
      failed: (failure) => {
        if (!request.signal.aborted) {
          setError(failure);
          setStatus("paused");
          setText("");
        }
      },
      event: (event: VoiceServerEvent) => {
        if (request.signal.aborted || callbacks.current.sessionId !== options.sessionId) return;
        if (event.type === "error") {
          setError(new Error(event.code));
          return;
        }
        if (event.type === "status" && ["listening", "transcribing"].includes(event.status)) {
          setStatus(event.status);
          return;
        }
        if (event.type !== "transcript") return;
        if (preferences.current.muted) return;
        if (event.final && finals.current.has(event.utteranceId)) return;
        if (event.final) finals.current.add(event.utteranceId);
        if (finals.current.size > 256) finals.current.delete(finals.current.values().next().value!);
        setText(event.text);
        callbacks.current.transcript(event.text, event.final, event.utteranceId, next);
        if (event.final) finalWait.current?.();
      },
    });
    void capture.catch(() => {});
    try {
      const active = await capture;
      if (request.signal.aborted) await active.close();
      else {
        client.current = active;
        active.mute(preferences.current.muted);
        active.pauseReading(preferences.current.readingPaused);
      }
    } catch (failure) {
      const cancelled = request.signal.aborted;
      request.abort();
      void capture.then((active) => active.close()).catch(() => {});
      if (controller.current === request && !cancelled) {
        setError(failure);
        setStatus("paused");
      }
    }
  };
  useEffect(() => {
    void stop();
    return () => {
      controller.current?.abort();
      void client.current?.close();
    };
  }, [options.sessionId, stop]);
  useEffect(() => {
    const pause = () => {
      if (!currentMode.current) return;
      controller.current?.abort();
      void client.current?.close();
      client.current = undefined;
      finalWait.current?.();
      setText("");
      setStatus("paused");
    };
    const visibility = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("offline", pause);
    window.addEventListener("pagehide", pause);
    return () => {
      controller.current?.abort();
      void client.current?.close();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("offline", pause);
      window.removeEventListener("pagehide", pause);
    };
  }, []);
  const speak = useCallback((value: string) => client.current?.speak(value), []);
  const finish = useCallback(() => client.current?.finish(), []);
  const endInput = useCallback(async () => {
    const active = client.current;
    if (!active || currentMode.current !== "dictation") return stop();
    setStatus("transcribing");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1800);
      finalWait.current = () => {
        clearTimeout(timer);
        resolve();
      };
      active.finish();
    });
    finalWait.current = undefined;
    if (client.current === active) await stop();
  }, [stop]);
  const interrupt = useCallback(() => client.current?.interrupt(), []);
  const mute = useCallback((value: boolean) => {
    preferences.current.muted = value;
    setMuted(value);
    client.current?.mute(value);
    if (value) setText("");
  }, []);
  const pauseReading = useCallback((value: boolean) => {
    preferences.current.readingPaused = value;
    setReadingPaused(value);
    client.current?.pauseReading(value);
  }, []);
  return {
    mode,
    status,
    text,
    error,
    muted,
    readingPaused,
    start,
    stop,
    speak,
    finish,
    endInput,
    interrupt,
    mute,
    pauseReading,
  };
};
