import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./ComposerSendButton.css";

export const ComposerSendButton = ({
  running,
  disabled,
  stopping,
  onStop,
  resume,
  onResume,
}: {
  running: boolean;
  disabled: boolean;
  stopping: boolean;
  onStop(): void;
  resume?: { disabled: boolean };
  onResume?(): void;
}) => {
  const { t } = useTranslation();
  return (
    <>
      {running && (
        <ActionButton
          className="composer-send stop"
          aria-label={t("stop")}
          aria-busy={stopping}
          disabled={stopping}
          onClick={onStop}
        >
          ■
        </ActionButton>
      )}
      {!running && resume ? (
        <ActionButton
          className="composer-send resume"
          aria-label={t("resume")}
          title={t("resume")}
          disabled={resume.disabled || stopping}
          onClick={onResume}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </ActionButton>
      ) : (
        (!running || !disabled) && (
          <ActionButton
            className="composer-send primary"
            type="submit"
            aria-label={t("send")}
            disabled={disabled}
          >
            ↑
          </ActionButton>
        )
      )}
    </>
  );
};
