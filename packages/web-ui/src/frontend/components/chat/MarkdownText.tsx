import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCopy } from "../../hooks/useCopy";
import { useMermaid } from "../../hooks/useMermaid";
import { renderMarkdown } from "../../lib/markdown";
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
  const html = useMemo(() => renderMarkdown(text, t("copy"), t("table")), [text, t]);
  const ref = useMermaid(html, streaming);

  return (
    <div className="markdown-container">
      <div
        ref={ref}
        className="markdown-text"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(event) => {
          const target = event.target as Element;
          const button = target.closest(".markdown-code-copy");
          const code = button?.parentElement?.querySelector("code")?.textContent;

          if (code !== null && code !== undefined) void copy(code);
        }}
      />
      <span className="sr-only" aria-live="polite">
        {status !== "copy" ? t(status) : ""}
      </span>
    </div>
  );
};
