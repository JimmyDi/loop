import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCopy } from "../../hooks/useCopy";
import { useMermaid } from "../../hooks/useMermaid";
import { useMarkdown } from "../../hooks/useMarkdown";
import { MessageImageGallery } from "./MessageImageGallery";
import { MessageFiles } from "./MessageFiles";
import "./MarkdownText.css";
import "./MarkdownHighlight.css";

export const MarkdownText = ({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) => {
  const { t } = useTranslation();
  const { copy, status } = useCopy();
  const html = useMarkdown(text, t("copy"), t("table"));
  const { markup, images, files } = useMemo(() => {
    const root = document.createElement("div");
    root.innerHTML = html;
    const images = [...root.querySelectorAll("img[src]")].map((image) => ({
      src: image.getAttribute("src")!,
      alt: image.getAttribute("alt") ?? "",
    }));
    for (const image of root.querySelectorAll("img[src]")) image.remove();
    const files = [...root.querySelectorAll("a[data-session-file]")].map((anchor) => ({
      href: anchor.getAttribute("href")!,
      label: anchor.textContent ?? "",
    }));
    for (const anchor of root.querySelectorAll("a[data-session-file]")) anchor.remove();
    for (const element of root.querySelectorAll("p,a"))
      if (!element.textContent?.trim() && !element.children.length) element.remove();
    return { markup: { __html: root.innerHTML }, images, files };
  }, [html]);
  const ref = useMermaid(markup.__html, streaming);

  return (
    <div className="markdown-container">
      <div
        ref={ref}
        className="markdown-text"
        dangerouslySetInnerHTML={markup}
        onClick={(event) => {
          const target = event.target as Element;
          const button = target.closest(".markdown-code-copy");
          const code = button?.parentElement?.querySelector("code")?.textContent;

          if (code !== null && code !== undefined) void copy(code);
        }}
      />
      <MessageImageGallery images={images} />
      <MessageFiles files={files} />
      <span className="sr-only" aria-live="polite">
        {status !== "copy" ? t(status) : ""}
      </span>
    </div>
  );
};
