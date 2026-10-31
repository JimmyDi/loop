import { en } from "./i18n/en";
import { zh } from "./i18n/zh";

export const translations = { en, zh } as const;

export type TranslationKey = keyof typeof en;

export type Language = keyof typeof translations;
