import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { Language, TranslationKey } from "../translations";
import { translations } from "../translations";
import { browserLanguage } from "./language";
import { LanguageContext } from "./LanguageContext";
import { updatePageMetadata } from "../page-metadata";

export const LanguageProvider = ({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) => {
  const [language, setLanguage] = useState<Language>(
    () =>
      initialLanguage ??
      (typeof navigator === "undefined"
        ? "zh"
        : browserLanguage(navigator.languages.length ? navigator.languages : [navigator.language])),
  );
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    updatePageMetadata(location.pathname, language);
  }, [language]);
  const t = (key: TranslationKey): string => translations[language][key];
  return <LanguageContext value={{ language, setLanguage, t }}>{children}</LanguageContext>;
};
