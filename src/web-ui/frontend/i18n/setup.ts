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
});

if (typeof document !== "undefined") document.documentElement.lang = i18n.language;

i18n.on("languageChanged", (language) => {
  writePreference("language", language);

  if (typeof document !== "undefined") document.documentElement.lang = language;
});

export { i18n };
