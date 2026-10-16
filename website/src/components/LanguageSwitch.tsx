import { useLanguage } from "../i18n/useLanguage";
import styles from "./LanguageSwitch.module.css";

export const LanguageSwitch = () => {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div
      className={styles["language-switch"]}
      data-language={language}
      role="group"
      aria-label={t("languageSwitcher")}
    >
      <button
        type="button"
        lang="zh-CN"
        aria-pressed={language === "zh"}
        onClick={() => setLanguage("zh")}
      >
        中文
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
};
