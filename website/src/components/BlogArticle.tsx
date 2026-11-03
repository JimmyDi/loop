import posts from "virtual:blog-content";

import { asset } from "../assets";
import { blogPost, categoryLabel, readingLabel } from "../blog/blog";
import type { BlogBodies } from "../blog/types";
import { useLanguage } from "../i18n/useLanguage";
import { BlogCard } from "./BlogCard";
import { BlogBody } from "./BlogBody";
import { useCopyCommand } from "./useCopyCommand";
import styles from "./BlogArticle.module.css";

export const BlogArticle = ({ route, bodies = {} }: { route: string; bodies?: BlogBodies }) => {
  const { language } = useLanguage();
  const post = blogPost(route);
  const article = post?.[language];
  const copy = useCopyCommand(
    typeof location === "undefined" ? "" : new URL(asset(route), location.href).href,
  );
  if (!article)
    return (
      <div className={styles.page}>
        <h1 tabIndex={-1}>{language === "zh" ? "文章不存在" : "Article not found"}</h1>
        <a href={asset("blog/")}>{language === "zh" ? "返回博客" : "Back to blog"}</a>
      </div>
    );
  const related = posts.filter((entry) => entry.slug !== post.slug).slice(0, 2);
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <a href={asset("blog/")}>{language === "zh" ? "← 全部文章" : "← All articles"}</a>
        <p className={styles.category}>{categoryLabel(article.category, language)}</p>
        <h1 tabIndex={-1}>{article.title}</h1>
        <p className={styles.summary}>{article.summary}</p>
        <div className={styles.meta}>
          <span>{article.author}</span>
          <time dateTime={article.publishedAt}>{article.publishedAt}</time>
          <span>{readingLabel(article.readingMinutes, language)}</span>
          {article.updatedAt && (
            <span>
              {language === "zh" ? "更新于 " : "Updated "}
              {article.updatedAt}
            </span>
          )}
        </div>
        <button type="button" onClick={copy.copy}>
          {language === "zh" ? "复制链接" : "Copy link"}
        </button>
        <span className={styles.feedback} role="status">
          {copy.feedback &&
            (copy.feedback === "copied"
              ? language === "zh"
                ? "链接已复制"
                : "Link copied"
              : language === "zh"
                ? "复制失败，请从地址栏复制链接。"
                : "Copy failed. Copy the URL from the address bar.")}
        </span>
      </header>
      <div className={styles.layout}>
        <BlogBody key={post.slug} post={post} bodies={bodies} />
        {article.headings.length >= 3 && (
          <aside className={styles.toc}>
            <details open>
              <summary>{language === "zh" ? "本文目录" : "On this page"}</summary>
              <nav aria-label={language === "zh" ? "本文目录" : "On this page"}>
                {article.headings.map((heading) => (
                  <a key={heading.id} href={asset(route + "#" + language + "-" + heading.id)}>
                    {heading.title}
                  </a>
                ))}
              </nav>
            </details>
          </aside>
        )}
      </div>
      {related.length > 0 && (
        <section className={styles.related}>
          <h2>{language === "zh" ? "继续阅读" : "Keep reading"}</h2>
          <div>
            {related.map((entry) => (
              <BlogCard key={entry.slug} article={entry[language]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
