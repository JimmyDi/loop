import { useEffect } from "react";

import { useLanguage } from "../i18n/useLanguage";
import { asset } from "../assets";
import { resolveContentRoute } from "../content-routes";
import { ContentArticle } from "./ContentArticle";
import { DocsNavigation } from "./DocsNavigation";
import styles from "./DocsPage.module.css";

export const DocsPage = ({ route }: { route: string }) => {
  const { release, page } = resolveContentRoute(route);
  const { language } = useLanguage();
  useEffect(() => {
    document.title = (page?.title ?? "Documentation") + " · Loop " + (release?.version ?? "");
  }, [page, release]);
  if (!release || !page)
    return (
      <div className={styles.missing}>
        <h1>{language === "zh" ? "文档不存在" : "Documentation not found"}</h1>
      </div>
    );
  return (
    <div className={styles.layout}>
      <DocsNavigation version={release.version} slug={page.slug} />
      <article>
        <p className={styles.version}>
          Loop {release.version} · {release.date}
        </p>
        {language === "zh" && <p className={styles.notice}>本版本文档保留发布时的英文原文。</p>}
        <ContentArticle html={page.html} route={route} />
      </article>
      <nav className={styles.contents} aria-label={language === "zh" ? "页内目录" : "On this page"}>
        <strong>{language === "zh" ? "页内目录" : "On this page"}</strong>
        {page.headings.map((heading) => (
          <a href={asset(route + "#" + heading.id)} key={heading.id}>
            {heading.title}
          </a>
        ))}
      </nav>
    </div>
  );
};
