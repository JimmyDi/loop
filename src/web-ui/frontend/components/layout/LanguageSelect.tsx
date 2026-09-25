import { useTranslation } from "react-i18next";

import "./LanguageSelect.css";

export const LanguageSelect = () => {
  const { t, i18n } = useTranslation();

  return (
    <label className="language-select">
      {t("language")}
      <select
        aria-label={t("language")}
        value={i18n.language}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </label>
  );
};
