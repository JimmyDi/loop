import { createContext } from "react";

import type { Language, TranslationKey } from "../translations";
import { translations } from "../translations";

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

export const LanguageContext = createContext<LanguageState>({
  language: "zh",
  setLanguage: () => {},
  t: (key) => translations.zh[key],
});
