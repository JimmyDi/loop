import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../shared/protocol";
import type { VoiceControl } from "./voice-hook-types";
import { VoiceNarrationTracker } from "../voice/voice-narration-tracker";

export const useVoiceNarration = (snapshot: SessionSnapshot, voice: VoiceControl) => {
  const { t } = useTranslation();
  const tracker = useRef(new VoiceNarrationTracker());
  const reset = useCallback(() => tracker.current.reset(snapshot), [snapshot]);
  useEffect(() => {
    if (voice.mode !== "conversation") return;
    const rows = tracker.current.next(snapshot);
    if (voice.readingPaused || !["listening", "transcribing", "speaking"].includes(voice.status))
      return;
    for (const row of rows.slice(-3))
      voice.speak(row.kind === "reply" ? row.text : t("voice." + row.kind, { name: row.text }));
  }, [snapshot, voice.mode, voice.status, voice.readingPaused, voice.speak, t]);
  return reset;
};
