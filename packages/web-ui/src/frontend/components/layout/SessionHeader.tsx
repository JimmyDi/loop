import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { useWorkspace } from "../../state/workspace-store";
import { ActionButton } from "../ui/ActionButton";
import { SessionName } from "./SessionName";
import type { SessionHeaderProps } from "./session-header-types";
import "./SessionHeader.css";

export const SessionHeader = ({
  snapshot,
  panel,
  tabs,
}: SessionHeaderProps & {
  panel?: { open: boolean; toggle(): void };
  tabs?: ReactNode;
}) => {
  const { t } = useTranslation();
  const toggle = useWorkspace((state) => state.toggleSidebar);

  return (
    <header className="session-header">
      {panel && <span className="session-header-panel-divider" aria-hidden="true" />}
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
      {panel && (
        <ActionButton
          className="session-panel-toggle ghost"
          aria-label={t(panel.open ? "closePanel" : "openPanel")}
          title={t(panel.open ? "closePanel" : "openPanel")}
          aria-expanded={panel.open}
          onClick={panel.toggle}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M15 4v16" />
          </svg>
        </ActionButton>
      )}
      {panel?.open && <div className="session-header-panel-tabs">{tabs}</div>}
    </header>
  );
};
