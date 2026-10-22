import hljs from "highlight.js";

export const highlightCode = (text: string, language: string): string | undefined =>
  hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : undefined;
