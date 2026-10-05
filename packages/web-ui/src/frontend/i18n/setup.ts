import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { writePreference } from "../lib/preferences";
import { en } from "./en";
import { getInitialLanguage } from "./language";
import { zh } from "./zh";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  initAsync: false,
  react: { bindI18nStore: "added removed" },
});

if (typeof document !== "undefined") document.documentElement.lang = i18n.language;

const onLanguageChanged = (language: string): void => {
  writePreference("language", language);

  if (typeof document !== "undefined") document.documentElement.lang = language;
};

i18n.on("languageChanged", onLanguageChanged);

if (import.meta.hot) {
  import.meta.hot.accept("./en", (updated) => {
    if (updated) i18n.addResourceBundle("en", "translation", updated.en, true, true);
  });
  import.meta.hot.accept("./zh", (updated) => {
    if (updated) i18n.addResourceBundle("zh", "translation", updated.zh, true, true);
  });
  import.meta.hot.dispose(() => {
    i18n.off("languageChanged", onLanguageChanged);
  });
}

export { i18n };
