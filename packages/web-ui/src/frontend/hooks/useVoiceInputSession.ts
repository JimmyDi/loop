import { useEffect, useRef, useState } from "react";

import type { VoiceInputSessionOptions } from "./voice-input-session-types";
import type { VoiceDictationControl } from "./voice-dictation-types";
import type { VoiceControl } from "./voice-hook-types";

export const useVoiceInputSession = (options: VoiceInputSessionOptions): VoiceDictationControl => {
  const callbacks = useRef(options);
  callbacks.current = options;
  const [active, setActive] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [samples, setSamples] = useState<number[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const state = useRef({ active: false, finishing: false, generation: 0, speech: false, frame: 0 });
  const phrases = useRef(new Map<string, string>());
  const silence = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reset = () => {
    state.current.active = false;
    state.current.finishing = false;
    state.current.generation++;
    state.current.speech = false;
    clearTimeout(silence.current);
    setActive(false);
    setFinishing(false);
    setSpeaking(false);
    setSamples([]);
    phrases.current.clear();
  };
  useEffect(() => {
    reset();
    return () => {
      state.current.active = false;
      state.current.generation++;
      clearTimeout(silence.current);
    };
  }, [options.identity]);
  return {
    active,
    finishing,
    samples,
    speaking,
    begin: () => {
      reset();
      state.current.active = true;
      state.current.frame = 0;
      setActive(true);
    },
    transcript: (text, final, id) => {
      if (state.current.active && (!callbacks.current.finalOnly || final) && text.trim())
        phrases.current.set(id, text.trim());
    },
    energy: (value) => {
      if (!state.current.active || state.current.finishing) return;
      if (value >= (state.current.speech ? 0.006 : 0.012)) {
        state.current.speech = true;
        setSpeaking(true);
        clearTimeout(silence.current);
        silence.current = setTimeout(() => {
          state.current.speech = false;
          setSpeaking(false);
        }, 1200);
      }
      if (performance.now() - state.current.frame < 70) return;
      state.current.frame = performance.now();
      setSamples((previous) => [...previous.slice(-79), value]);
    },
    finish: async (voice: VoiceControl) => {
      if (!state.current.active || state.current.finishing) return;
      state.current.finishing = true;
      setFinishing(true);
      const generation = state.current.generation;
      try {
        await voice.endInput();
      } catch {
        if (generation === state.current.generation) reset();
        return;
      }
      if (!state.current.active || generation !== state.current.generation) return;
      const text = [...phrases.current.values()].join(" ");
      reset();
      callbacks.current.complete(text);
    },
    discard: (voice) => {
      reset();
      void voice.stop();
    },
  };
};
