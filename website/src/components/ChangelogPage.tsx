import { useEffect, useState } from "react";
import releases from "virtual:release-content";

import { asset } from "../assets";
import { resolveContentRoute } from "../content-routes";
import { useLanguage } from "../i18n/useLanguage";
import { ContentArticle } from "./ContentArticle";
import styles from "./ChangelogPage.module.css";

export const ChangelogPage = ({ route }: { route: string }) => {
  const { language } = useLanguage();
  const { release, detail } = resolveContentRoute(route);
  const [count, setCount] = useState(5);
  useEffect(() => {
    document.title = (detail ? (release?.title ?? "Not found") : "Changelog") + " · Loop";
  }, [detail, release]);
  if (detail && !release)
    return (
      <div className={styles.page}>
        <h1>{language === "zh" ? "版本不存在" : "Release not found"}</h1>
      </div>
    );
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p>LOOP / {language === "zh" ? "更新日志" : "CHANGELOG"}</p>
        <h1>
          {detail
            ? release!.title
            : language === "zh"
              ? "每一版，都更进一步。"
              : "Every release, a step forward."}
        </h1>
        <p>
          {language === "zh"
            ? "已正式发布的功能、改进与修复。"
            : "Released features, improvements and fixes."}
        </p>
        <a href={asset(detail ? "changelog/" : "changelog.xml")}>
          {detail ? (language === "zh" ? "← 全部更新日志" : "← All releases") : "RSS ↗"}
        </a>
      </header>
      {(detail ? [release!] : releases.slice(0, count)).map((entry) => (
        <article className={styles.release} key={entry.version}>
          <div className={styles.date}>
            <span>{language === "zh" ? "正式发布" : "RELEASE"}</span>
            <time dateTime={entry.date}>{entry.date}</time>
          </div>
          {!detail && (
            <h2>
              <a href={asset("changelog/" + entry.version + "/")}>{entry.title}</a>
            </h2>
          )}
          <p className={styles.summary}>{entry.summary}</p>
          {detail ? (
            <ContentArticle html={entry.html} route={route} />
          ) : (
            <a className={styles.more} href={asset("changelog/" + entry.version + "/")}>
              {language === "zh" ? "查看完整更新" : "Read full release notes"} →
            </a>
          )}
        </article>
      ))}
      {!detail && count < releases.length && (
        <button type="button" onClick={() => setCount(count + 5)}>
          {language === "zh" ? "更多版本" : "More releases"}
        </button>
      )}
    </div>
  );
};
