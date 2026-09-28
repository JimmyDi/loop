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
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <path d="M3 10h18" />
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
