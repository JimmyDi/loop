import { useTranslation } from "react-i18next";

import "./ThinkingBlock.css";

export const ThinkingBlock = ({ text }: { text: string }) => {
  const { t } = useTranslation();

  return (
    <details className="thinking-block">
      <summary>{t("thinking")}</summary>
      <div>{text}</div>
    </details>
  );
};
