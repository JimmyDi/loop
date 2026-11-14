import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import "./WorkspacePanel.css";

export const WorkspacePanel = <T,>({
  tabs,
  active,
  renderContent,
}: {
  tabs: { id: string; title: string; content: T }[];
  active?: string;
  renderContent(content: T): ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <aside className="workspace-panel" aria-label={t("workspacePanel")}>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          className="workspace-panel-content"
          role="tabpanel"
          id={"panel-content-" + index}
          aria-labelledby={"panel-tab-" + index}
          hidden={tab.id !== active}
        >
          {renderContent(tab.content)}
        </div>
      ))}
    </aside>
  );
};
