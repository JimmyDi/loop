import { useVoiceSampleCountdown } from "../../hooks/useVoiceSampleCountdown";
import type { VoiceInputRecordingProps } from "./voice-input-recording-types";
import { VoiceInputSampler } from "./VoiceInputSampler";
import "./VoiceInputRecording.css";

export const VoiceInputRecording = ({
  input,
  voice,
  durationSeconds,
  disabled = false,
  onDiscard,
  dense,
}: VoiceInputRecordingProps) => {
  const recording = input.active && !input.finishing;
  const listening = ["listening", "transcribing"].includes(voice.status);
  const remaining = useVoiceSampleCountdown(
    recording,
    listening,
    () => input.finish(voice),
    durationSeconds,
  );
  return (
    <VoiceInputSampler
      samples={input.samples}
      dense={dense}
      active={input.active && !disabled}
      connecting={input.active && !listening && !input.finishing}
      recording={recording && listening && !disabled}
      remaining={remaining}
      onDiscard={onDiscard}
      onFinish={() => void input.finish(voice)}
    />
  );
};
