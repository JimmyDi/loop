import type { Language } from "../translations";

type InitialMetadata = Record<
  "title" | "description" | "socialDescription",
  Record<Language, string>
>;

// Serialized into a parser-blocking script after the static markup, before first paint.
export const initializeLanguage = (
  resolveLanguage: (languages: readonly string[]) => Language,
  metadata: InitialMetadata,
): void => {
  const language = resolveLanguage(
    navigator.languages.length ? navigator.languages : [navigator.language],
  );
  const root = document.getElementById("root");
  const english = document.getElementById("initial-english") as HTMLTemplateElement | null;
  if (root && english && language === "en") root.replaceChildren(english.content);
  english?.remove();
  if (root) root.dataset.language = language;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = metadata.title[language];
  const entries = [
    ['meta[name="description"]', "description"],
    ['meta[property="og:title"]', "title"],
    ['meta[property="og:description"]', "socialDescription"],
  ] as const;
  for (const [selector, key] of entries) {
    document.querySelector(selector)?.setAttribute("content", metadata[key][language]);
  }
  delete document.documentElement.dataset.languagePending;
};
