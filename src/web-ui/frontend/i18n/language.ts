import { readPreference } from "../lib/preferences";

export type Language = "en" | "zh";

export const resolveLanguage = (saved: unknown, browserLanguages: readonly string[]): Language => {
  if (saved === "en" || saved === "zh") return saved;

  for (const language of browserLanguages) {
    const base = language.toLowerCase().split("-")[0];

    if (base === "zh" || base === "en") return base;
  }

  return "en";
};

export const getInitialLanguage = (): Language => {
  const browser = typeof navigator === "undefined" ? undefined : navigator;
  const languages = browser?.languages?.length ? browser.languages : [browser?.language ?? ""];

  return resolveLanguage(readPreference<unknown>("language", null), languages);
};
