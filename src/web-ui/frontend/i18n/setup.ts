import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { readPreference, writePreference } from "../lib/preferences";
import { en } from "./en";
import { zh } from "./zh";

const saved = readPreference<string>("language", "en");

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: saved === "zh" ? "zh" : "en",
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
