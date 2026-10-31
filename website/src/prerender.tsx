import { renderToString } from "react-dom/server";

import { App } from "./App";
import { setPrerenderAssetBase } from "./assets";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { initializeLanguage } from "./i18n/initializeLanguage";
import { browserLanguage } from "./i18n/language";
import type { Language } from "./translations";
import { translations } from "./translations";
import { contentRoutes } from "./content-routes";

export const render = (
  base = import.meta.env.BASE_URL,
  language: Language = "zh",
  path = "",
): string => {
  setPrerenderAssetBase(base);
  return renderToString(
    <LanguageProvider initialLanguage={language}>
      <App path={path} />
    </LanguageProvider>,
  );
};

export const routes = contentRoutes;
export const languageBootstrap = (): string =>
  `(${initializeLanguage.toString()})(${browserLanguage.toString()}, ${JSON.stringify({
    title: { en: translations.en.title, zh: translations.zh.title },
    description: { en: translations.en.description, zh: translations.zh.description },
    socialDescription: {
      en: translations.en.socialDescription,
      zh: translations.zh.socialDescription,
    },
  }).replaceAll("<", "\\u003c")});`;
