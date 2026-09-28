import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { SessionName } from "./SessionName";
import "./SessionHeader.css";

export const SessionHeader = ({ snapshot }: { snapshot?: SessionSnapshot }) => {
  const { t } = useTranslation();
  const toggle = useWorkspace((state) => state.toggleSidebar);

  return (
    <header className="session-header">
      <ActionButton
        className="session-folder ghost"
        aria-label={t("openSidebar")}
        onClick={() => toggle(true)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 9h18M3 19V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      </ActionButton>
      {snapshot ? (
        <SessionName key={snapshot.sessionId} snapshot={snapshot} />
      ) : (
        <span className="session-name-placeholder">{t("newSession")}</span>
      )}
    </header>
  );
};
