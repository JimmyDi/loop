import { useTranslation } from "react-i18next";

import { SidebarMenu } from "./SidebarMenu";
import "./NavigationBar.css";

export const NavigationBar = ({
  settingsOpen,
  collapsed = false,
  onSettings,
}: {
  settingsOpen: boolean;
  collapsed?: boolean;
  onSettings(): void;
}) => {
  const { t } = useTranslation();
  return (
    <nav className="navigation-bar" aria-label={t("appNavigation")} inert={collapsed}>
      <SidebarMenu onOpenSettings={onSettings} active={settingsOpen} />
    </nav>
  );
};
