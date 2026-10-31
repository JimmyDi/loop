import { useState } from "react";
import releases from "virtual:release-content";

import { asset } from "../assets";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./DocsNavigation.module.css";

export const DocsNavigation = ({ version, slug }: { version: string; slug: string }) => {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const release = releases.find((entry) => entry.version === version)!;
  const pages = release.pages.filter(
    (page) => !query.trim() || page.search.includes(query.trim().toLowerCase()),
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
        onChange={(event) => setQuery(event.target.value)}
      />
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
