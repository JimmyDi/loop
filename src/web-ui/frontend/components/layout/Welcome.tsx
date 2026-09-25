import { useTranslation } from "react-i18next";

import { SessionHeader } from "./SessionHeader";
import { SessionTabs } from "./SessionTabs";
import "./Welcome.css";

export const Welcome = () => {
  const { t } = useTranslation();

  return (
    <main className="welcome">
      <SessionHeader />
      <SessionTabs />
      <div className="welcome-content">
        <span aria-hidden="true">∞</span>
        <h1>{t("welcome")}</h1>
        <p>{t("welcomeDetail")}</p>
      </div>
    </main>
  );
};
