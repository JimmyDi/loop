import DOMPurify from "dompurify";
import { Marked } from "marked";

import { localImagePath } from "../../shared/message-images";
import { localFilePath } from "../../shared/message-files";

const parser = new Marked({ gfm: true, breaks: true });

export type MarkdownEnhancements = {
  math?: Marked;
  highlight?: (text: string, language: string) => string | undefined;
};

export const renderMarkdown = (
  text: string,
  copyLabel: string,
  tableLabel: string,
  enhancements: MarkdownEnhancements = {},
  sessionId?: string,
): string => {
  const html = (enhancements.math ?? parser).parse(text, {
    async: false,
    walkTokens: (token) => {
      if ((token.type !== "image" && token.type !== "link") || !sessionId) return;
      const path = (token.type === "image" ? localImagePath : localFilePath)(token.href);
      if (path)
        token.href =
          "/api/sessions/" +
          encodeURIComponent(sessionId) +
          (token.type === "image" ? "/images?path=" : "/files?path=") +
          encodeURIComponent(path);
    },
  });
  const root = document.createElement("div");

  root.innerHTML = DOMPurify(window).sanitize(html, { USE_PROFILES: { html: true, mathMl: true } });

  for (const element of root.querySelectorAll("button,input,textarea,select,form,iframe,object"))
    element.remove();

  for (const code of root.querySelectorAll<HTMLElement>("pre > code")) {
    const language = [...code.classList].find((value) => value.startsWith("language-"))?.slice(9);
    const original = code.textContent ?? "";

    const highlighted = language && enhancements.highlight?.(original, language);
    if (highlighted) code.innerHTML = highlighted;

    const button = document.createElement("button");

    button.type = "button";
    button.className = "markdown-code-copy";
    button.textContent = copyLabel;
    button.setAttribute("aria-label", copyLabel);
    code.parentElement?.prepend(button);
  }

  for (const table of root.querySelectorAll("table")) {
    const wrapper = document.createElement("div");

    wrapper.className = "markdown-table-scroll";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", tableLabel);
    wrapper.tabIndex = 0;
    table.replaceWith(wrapper);
    wrapper.append(table);
  }

  for (const anchor of root.querySelectorAll("a")) {
    anchor.removeAttribute("data-session-file");
    const href = anchor.getAttribute("href") ?? "";
    const filePrefix = sessionId
      ? "/api/sessions/" + encodeURIComponent(sessionId) + "/files?path="
      : undefined;
    if (filePrefix && href.startsWith(filePrefix)) {
      anchor.setAttribute("data-session-file", "true");
      continue;
    }

    if (!/^https?:\/\//i.test(href)) anchor.removeAttribute("href");
    else {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
  }

  return root.innerHTML;
};
