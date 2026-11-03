import { useState } from "react";

import { asset } from "../assets";
import { categoryLabel, readingLabel } from "../blog/blog";
import type { BlogIndexPost } from "../blog/types";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./BlogDataGrid.module.css";

export const BlogDataGrid = ({ posts }: { posts: BlogIndexPost[] }) => {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const search = query.trim().toLocaleLowerCase();
  const filtered = posts.filter((post) =>
    [post[language].title, post[language].summary].some((value) =>
      value.toLocaleLowerCase().includes(search),
    ),
  );
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visible.length < filtered.length;
  const title = language === "zh" ? "所有文章" : "All articles";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{title}</h2>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(10);
          }}
          aria-label={language === "zh" ? "搜索文章" : "Search articles"}
          placeholder={language === "zh" ? "搜索文章" : "Search articles"}
        />
      </div>
      <div className={styles.scroll} role="region" aria-label={title} tabIndex={0}>
        <table className={styles.table} aria-label={title}>
          <tbody>
            {visible.map((post) => {
              const article = post[language];
              return (
                <tr key={post.slug}>
                  <td className={styles.metadata}>
                    <time dateTime={article.publishedAt}>{article.publishedAt}</time>
                    <span aria-hidden="true"> · </span>
                    {categoryLabel(article.category, language)}
                  </td>
                  <th scope="row">
                    <a href={asset("blog/" + post.slug + "/")}>{article.title}</a>
                  </th>
                  <td>{article.author}</td>
                  <td>{readingLabel(article.readingMinutes, language)}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} role="status">
                  {language === "zh"
                    ? "没有找到相关文章，请尝试其他关键词。"
                    : "No matching articles. Try another search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className={styles.pagination}>
          <button type="button" onClick={() => setVisibleCount((count) => count + 10)}>
            {language === "zh" ? "查看更多" : "View more"}
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      )}
    </div>
  );
};
