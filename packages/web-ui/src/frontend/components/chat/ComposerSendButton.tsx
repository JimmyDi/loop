import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./ComposerSendButton.css";

export const ComposerSendButton = ({
  running,
  disabled,
  stopping,
  onStop,
}: {
  running: boolean;
  disabled: boolean;
  stopping: boolean;
  onStop(): void;
}) => {
  const { t } = useTranslation();
  return running ? (
    <ActionButton
      className="composer-send stop"
      aria-label={t("stop")}
      disabled={stopping}
      onClick={onStop}
    >
      ■
    </ActionButton>
  ) : (
    <ActionButton
      className="composer-send primary"
      type="submit"
      aria-label={t("send")}
      disabled={disabled}
    >
      ↑
    </ActionButton>
  );
};
