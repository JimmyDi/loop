import { useTranslation } from "react-i18next";

import { useWorkspace } from "../../state/workspace-store";
import "./SessionTabs.css";

export const SessionTabs = () => {
  const { t } = useTranslation();
  const { tabs, active, open, close } = useWorkspace();

  return (
    <nav className="session-tabs" aria-label={t("newSession")}>
      {tabs.map((tab) => (
        <div key={tab.id} className="session-tab" data-active={active === tab.id}>
          <button
            type="button"
            aria-current={active === tab.id ? "page" : undefined}
            onClick={() => open(tab)}
          >
            {tab.title}
          </button>
          <button
            type="button"
            aria-label={t("closeTab") + ": " + tab.title}
            onClick={() => close(tab.id)}
          >
            ×
          </button>
        </div>
      ))}
    </nav>
  );
};
