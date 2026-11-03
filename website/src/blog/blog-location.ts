import type { Language } from "../translations";

export const blogLanguage = (path: string): Language | undefined => {
  if (/(?:^|\/)en\/blog(?:\/|$)/.test(path)) return "en";
  if (/(?:^|\/)blog(?:\/|$)/.test(path)) return "zh";
  return undefined;
};

export const blogPath = (route: string, language: Language): string =>
  (language === "en" ? "en/" : "") + route;
