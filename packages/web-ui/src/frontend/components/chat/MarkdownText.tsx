import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCopy } from "../../hooks/useCopy";
import { useMermaid } from "../../hooks/useMermaid";
import { useMarkdown } from "../../hooks/useMarkdown";
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
  const markup = useMemo(() => ({ __html: html }), [html]);
  const ref = useMermaid(html, streaming);

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
      <span className="sr-only" aria-live="polite">
        {status !== "copy" ? t(status) : ""}
      </span>
    </div>
  );
};
