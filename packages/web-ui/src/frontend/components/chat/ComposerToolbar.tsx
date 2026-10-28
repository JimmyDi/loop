import type { ComposerSubmitActionsProps } from "./composer-submit-actions-types";
import { ComposerSubmitActions } from "./ComposerSubmitActions";
import "./ComposerToolbar.css";

export const ComposerToolbar = ({ control, children }: ComposerSubmitActionsProps) => {
  const active = control.voice.mode === "conversation" || !!control.dictation?.active;
  return (
    <div className="composer-toolbar">
      {active ? <ComposerSubmitActions control={control}>{null}</ComposerSubmitActions> : children}
    </div>
  );
};
