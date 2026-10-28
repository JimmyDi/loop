import { useEffect } from "react";

import { VoiceInputRecording } from "../voice/VoiceInputRecording";
import type { VoiceInputButtonProps } from "./voice-input-button-types";
import "./ComposerVoiceInput.css";

export const ComposerVoiceInput = ({ control }: VoiceInputButtonProps) => {
  const { voice, dictation } = control;
  useEffect(() => {
    if (dictation?.active && (voice.error || voice.status === "paused")) dictation.discard(voice);
  }, [voice.error, voice.status]);
  if (!dictation) return null;
  return (
    <div className="composer-voice-input">
      <VoiceInputRecording
        input={dictation}
        voice={voice}
        durationSeconds={60}
        dense
        onDiscard={() => dictation.discard(voice)}
      />
    </div>
  );
};
