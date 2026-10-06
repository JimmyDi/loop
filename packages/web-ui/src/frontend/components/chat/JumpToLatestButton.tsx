import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./JumpToLatestButton.css";

export const JumpToLatestButton = ({
  running,
  onClick,
}: {
  running: boolean;
  onClick: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <ActionButton
      className="jump-latest"
      data-running={running}
      onClick={onClick}
      title={t("scrollBottom")}
      aria-label={t("scrollBottom")}
    >
      {running && (
        <span className="jump-latest-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
      <svg
        className="jump-latest-arrow"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 5v14m-6-6 6 6 6-6" />
      </svg>
    </ActionButton>
  );
};
