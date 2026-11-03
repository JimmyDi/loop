import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { asset } from "../assets";
import { blogLanguage, blogPath } from "../blog/blog-location";
import { normalizeRoute } from "../content-routes";
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
  const [language, updateLanguage] = useState<Language>(
    () =>
      initialLanguage ??
      (typeof location === "undefined" ? undefined : blogLanguage(location.pathname)) ??
      (typeof navigator === "undefined"
        ? "zh"
        : browserLanguage(navigator.languages.length ? navigator.languages : [navigator.language])),
  );
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    if (!document.getElementById("root")?.dataset.route)
      updatePageMetadata(location.pathname, language);
  }, [language]);
  const setLanguage = (next: Language) => {
    updateLanguage(next);
    if (blogLanguage(location.pathname) && blogLanguage(location.pathname) !== next) {
      const route = normalizeRoute(location.pathname);
      history.pushState(null, "", asset(blogPath(route, next)) + location.search + location.hash);
    }
  };
  useEffect(() => {
    const sync = () => {
      const locale = blogLanguage(location.pathname);
      if (locale) updateLanguage(locale);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const t = (key: TranslationKey): string => translations[language][key];
  return <LanguageContext value={{ language, setLanguage, t }}>{children}</LanguageContext>;
};
