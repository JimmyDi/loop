import { renderToString } from "react-dom/server";

import { blogLanguage } from "./blog/blog-location";
import { App } from "./App";
import { setPrerenderAssetBase } from "./assets";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { initializeLanguage } from "./i18n/initializeLanguage";
import { browserLanguage } from "./i18n/language";
import type { Language } from "./translations";
import { pageMetadata } from "./page-metadata";
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
export const metadata = pageMetadata;
export const languageBootstrap = (path = ""): string =>
  `(${initializeLanguage.toString()})(${browserLanguage.toString()}, ${JSON.stringify({
    title: { en: pageMetadata(path, "en").title, zh: pageMetadata(path, "zh").title },
    description: {
      en: pageMetadata(path, "en").description,
      zh: pageMetadata(path, "zh").description,
    },
    socialDescription: {
      en: pageMetadata(path, "en").socialDescription,
      zh: pageMetadata(path, "zh").socialDescription,
    },
  }).replaceAll("<", "\\u003c")}, ${JSON.stringify(blogLanguage(path))});`;

export { default as blogPosts } from "virtual:blog-content";
