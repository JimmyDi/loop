import type { Language } from "../translations";

export const browserLanguage = (languages: readonly string[]): Language =>
  /^zh(?:-|$)/i.test(languages[0] ?? "") ? "zh" : "en";
