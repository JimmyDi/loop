import { useRef, useState } from "react";

import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import { normalizeRoute } from "../content-routes";
import styles from "./ContentArticle.module.css";

export const ContentArticle = ({
  html,
  route = typeof location === "undefined" ? "" : normalizeRoute(location.pathname),
}: {
  html: string;
  route?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const articleHtml =
    html ||
    (typeof document === "undefined"
      ? ""
      : (document.querySelector("#root [data-content-article]")?.innerHTML ?? ""));
  const markup = articleHtml
    .replace(/href="#([^" ]*)"/g, (_, hash: string) => 'href="' + asset(route + "#" + hash) + '"')
    .replace(/href="(docs\/[^" ]*)"/g, (_, path: string) => 'href="' + asset(path) + '"');
  return (
    <div className={styles.article} ref={ref}>
      <div data-content-article dangerouslySetInnerHTML={{ __html: markup }} />
      <button
        type="button"
        className={styles.copy}
        onClick={async () => {
          const code = [...(ref.current?.querySelectorAll("pre code") ?? [])]
            .map((entry) => entry.textContent)
            .join("\n\n");
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        hidden={!articleHtml.includes("<pre>")}
      >
        {copied
          ? language === "zh"
            ? "已复制"
            : "Copied"
          : language === "zh"
            ? "复制本页全部代码示例"
            : "Copy all code examples on this page"}
      </button>
      <span role="status">{copied ? (language === "zh" ? "代码已复制" : "Code copied") : ""}</span>
    </div>
  );
};
