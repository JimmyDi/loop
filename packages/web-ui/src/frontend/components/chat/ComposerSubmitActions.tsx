import type { ComposerSubmitActionsProps } from "./composer-submit-actions-types";
import { VoiceInputButton } from "./VoiceInputButton";
import { VoiceCallButton } from "./VoiceCallButton";
import { ComposerVoiceInput } from "./ComposerVoiceInput";
import { ComposerVoiceCall } from "./ComposerVoiceCall";
import { ComposerVoiceOrb } from "./ComposerVoiceOrb";
import "./ComposerSubmitActions.css";

export const ComposerSubmitActions = ({ control, children }: ComposerSubmitActionsProps) => {
  const call = control.voice.mode === "conversation";
  const active = call || !!control.dictation?.active;
  return (
    <div className="composer-submit-actions" data-voice-active={active}>
      <div className="composer-voice-actions-slot">
        {active ? (
          call ? (
            <ComposerVoiceCall control={control} />
          ) : (
            <ComposerVoiceInput control={control} />
          )
        ) : (
          <>
            <VoiceInputButton control={control} />
            <VoiceCallButton control={control} />
          </>
        )}
      </div>
      <div className="composer-send-slot">
        {active ? <ComposerVoiceOrb control={control} /> : children}
      </div>
    </div>
  );
};
