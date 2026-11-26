import { useState } from "react";
import releases from "virtual:release-content";

import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./DocsNavigation.module.css";
import { useDocsSearch } from "./useDocsSearch";

export const DocsNavigation = ({ version, slug }: { version: string; slug: string }) => {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const search = useDocsSearch();
  const release = releases.find((entry) => entry.version === version)!;
  const term = query.trim().toLowerCase();
  const searching = !!term && search.status !== "ready";
  const pages = release.pages.filter(
    (page) => !term || searching || search.index?.[version]?.[page.slug]?.includes(term),
  );
  const groups = [...new Set(pages.map((page) => page.group))];
  return (
    <nav
      className={styles.navigation}
      aria-label={language === "zh" ? "文档导航" : "Documentation navigation"}
    >
      <input
        type="search"
        aria-label={language === "zh" ? "搜索文档" : "Search documentation"}
        placeholder={language === "zh" ? "搜索文档…" : "Search documentation…"}
        value={query}
        onFocus={() => void search.load()}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim()) void search.load();
        }}
      />
      {searching && (
        <p role="status">
          {search.status === "error" ? (
            <>
              {language === "zh" ? "搜索加载失败。" : "Search failed to load. "}
              <button type="button" onClick={() => void search.load()}>
                {language === "zh" ? "重试" : "Retry"}
              </button>
            </>
          ) : language === "zh" ? (
            "正在加载搜索…"
          ) : (
            "Loading search…"
          )}
        </p>
      )}
      {groups.map((group) => (
        <details key={group} open>
          <summary>{group}</summary>
          {pages
            .filter((page) => page.group === group)
            .map((page) => (
              <a
                key={page.slug}
                href={asset("docs/" + page.slug + "/")}
                aria-current={page.slug === slug ? "page" : undefined}
              >
                {page.title}
              </a>
            ))}
        </details>
      ))}
      {!pages.length && (
        <p role="status">{language === "zh" ? "没有匹配的文档" : "No matching documentation"}</p>
      )}
    </nav>
  );
};
