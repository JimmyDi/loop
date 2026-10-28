import type { VoiceDictationControl } from "../../hooks/voice-dictation-types";
import type { VoiceControl } from "../../hooks/voice-hook-types";

export interface VoiceInputRecordingProps {
  input: VoiceDictationControl;
  voice: VoiceControl;
  durationSeconds: number;
  dense?: boolean;
  disabled?: boolean;
  onDiscard(): void;
}
