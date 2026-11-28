import type { PromptContent } from "@loop/coding-agent";

import { readFileContent } from "./prompt-files";
import type { PromptFile } from "./prompt-files";
import { readFormContent } from "./prompt-form";
import type { PromptForm } from "./prompt-form";
import type { PromptImage } from "./prompt-images";

export const queuedContent = (content: PromptContent) => {
  const images: PromptImage[] = [];
  const files: PromptFile[] = [];
  let form: PromptForm | undefined;
  if (typeof content === "string") return { text: content, images, files, form };

  const text: string[] = [];
  for (const part of content) {
    if (part.type === "image") {
      images.push(part);
      continue;
    }
    const file = readFileContent(part.text);
    if (file) {
      files.push(file);
      continue;
    }
    const submitted = readFormContent(part.text);
    if (submitted) form ??= submitted;
    else text.push(part.text);
  }
  return { text: text.join("\n"), images, files, form };
};
