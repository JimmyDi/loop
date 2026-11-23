import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { SidebarMenu } from "./SidebarMenu";
import "./NavigationBar.css";

export const NavigationBar = ({
  settingsOpen,
  unread = false,
  onHome,
  onSettings,
  echoOpen = false,
  onEcho,
}: {
  settingsOpen: boolean;
  unread?: boolean;
  onHome(): void;
  onSettings(): void;
  echoOpen?: boolean;
  onEcho?(): void;
}) => {
  const { t } = useTranslation();
  return (
    <nav className="navigation-bar" aria-label={t("appNavigation")}>
      <ActionButton
        className="navigation-home ghost"
        aria-label={t("home")}
        title={t("home")}
        aria-current={!settingsOpen && !echoOpen ? "page" : undefined}
        onClick={onHome}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 10.5a2 2 0 0 1 .7-1.52l7-6a2 2 0 0 1 2.6 0l7 6a2 2 0 0 1 .7 1.52V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
        </svg>
        {unread && <span className="navigation-home-unread" role="img" aria-label={t("unread")} />}
      </ActionButton>
      {onEcho && (
        <ActionButton
          className="navigation-echo ghost"
          aria-label="Echo"
          title="Echo"
          aria-current={echoOpen && !settingsOpen ? "page" : undefined}
          onClick={onEcho}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        </ActionButton>
      )}
      <SidebarMenu active={settingsOpen} onOpenSettings={onSettings} />
    </nav>
  );
};
