import type { PromptContent } from "@loop/coding-agent";

import { readFileContent } from "./prompt-files";

export const queuedContent = (content: PromptContent) => {
  if (typeof content === "string") return { text: content, images: [], files: [] };
  return {
    text: content
      .flatMap((part) => (part.type === "text" && !readFileContent(part.text) ? [part.text] : []))
      .join(String.fromCharCode(10)),
    images: content.filter((part) => part.type === "image"),
    files: content.flatMap((part) =>
      part.type === "text" ? (readFileContent(part.text) ?? []) : [],
    ),
  };
};
