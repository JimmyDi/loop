import { useTranslation } from "react-i18next";

import { LoopIcon } from "../ui/LoopIcon";
import { SessionHeader } from "./SessionHeader";
import "./Welcome.css";

export const Welcome = () => {
  const { t } = useTranslation();

  return (
    <main className="welcome">
      <SessionHeader />
      <div className="welcome-content">
        <LoopIcon size={64} />
        <h1>{t("welcome")}</h1>
        <p>{t("welcomeDetail")}</p>
      </div>
    </main>
  );
};
