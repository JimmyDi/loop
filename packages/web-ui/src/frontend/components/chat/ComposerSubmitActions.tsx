import type { ComposerSubmitActionsProps } from "./composer-submit-actions-types";
import { VoiceInputButton } from "./VoiceInputButton";
import { VoiceCallButton } from "./VoiceCallButton";
import "./ComposerSubmitActions.css";

export const ComposerSubmitActions = ({
  control,
  showVoiceInput,
  children,
}: ComposerSubmitActionsProps) => (
  <div className="composer-submit-actions">
    {showVoiceInput && <VoiceInputButton control={control} />}
    <VoiceCallButton control={control} />
    {children}
  </div>
);
