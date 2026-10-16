import { renderToString } from "react-dom/server";

import { App } from "./App";
import { setPrerenderAssetBase } from "./assets";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { initializeLanguage } from "./i18n/initializeLanguage";
import { browserLanguage } from "./i18n/language";
import type { Language } from "./translations";
import { translations } from "./translations";

export const render = (base = import.meta.env.BASE_URL, language: Language = "zh"): string => {
  setPrerenderAssetBase(base);
  return renderToString(
    <LanguageProvider initialLanguage={language}>
      <App />
    </LanguageProvider>,
  );
};

export const languageBootstrap = (): string =>
  `(${initializeLanguage.toString()})(${browserLanguage.toString()}, ${JSON.stringify({
    title: translations.title,
    description: translations.description,
    socialDescription: translations.socialDescription,
  }).replaceAll("<", "\\u003c")});`;
