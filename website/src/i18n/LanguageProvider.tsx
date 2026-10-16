import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { Language, TranslationKey } from "../translations";
import { translations } from "../translations";
import { browserLanguage } from "./language";
import { LanguageContext } from "./LanguageContext";

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
    document.title = translations.title[language];
    const metadata = [
      ['meta[name="description"]', "description"],
      ['meta[property="og:title"]', "title"],
      ['meta[property="og:description"]', "socialDescription"],
    ] as const;
    for (const [selector, key] of metadata) {
      document.querySelector(selector)?.setAttribute("content", translations[key][language]);
    }
  }, [language]);
  const t = (key: TranslationKey): string => translations[key][language];
  return <LanguageContext value={{ language, setLanguage, t }}>{children}</LanguageContext>;
};
