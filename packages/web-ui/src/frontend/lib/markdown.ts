import DOMPurify from "dompurify";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import hljs from "highlight.js";

const parser = new Marked({ gfm: true, breaks: true }, markedKatex({ throwOnError: false }));

export const renderMarkdown = (text: string, copyLabel: string, tableLabel: string): string => {
  const html = parser.parse(text, { async: false });
  const root = document.createElement("div");

  root.innerHTML = DOMPurify(window).sanitize(html, { USE_PROFILES: { html: true, mathMl: true } });

  for (const element of root.querySelectorAll("button,input,textarea,select,form,iframe,object"))
    element.remove();

  for (const code of root.querySelectorAll<HTMLElement>("pre > code")) {
    const language = [...code.classList].find((value) => value.startsWith("language-"))?.slice(9);
    const original = code.textContent ?? "";

    if (language && hljs.getLanguage(language))
      code.innerHTML = hljs.highlight(original, { language }).value;

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
    const href = anchor.getAttribute("href") ?? "";

    if (!/^https?:\/\//i.test(href)) anchor.removeAttribute("href");
    else {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
  }

  return root.innerHTML;
};
