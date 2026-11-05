import posts from "virtual:blog-content";

import { blogPath } from "../blog/blog-location";
import { asset } from "../assets";
import { blogPost, readingLabel } from "../blog/blog";
import type { BlogBodies } from "../blog/types";
import { useLanguage } from "../i18n/useLanguage";
import { BlogCard } from "./BlogCard";
import { BlogBody } from "./BlogBody";
import { BlogIllustration } from "./BlogIllustration";
import styles from "./BlogArticle.module.css";

export const BlogArticle = ({ route, bodies = {} }: { route: string; bodies?: BlogBodies }) => {
  const { language } = useLanguage();
  const post = blogPost(route);
  const article = post?.[language];
  if (!article)
    return (
      <div className={styles.page}>
        <h1 tabIndex={-1}>{language === "zh" ? "文章不存在" : "Article not found"}</h1>
        <a href={asset(blogPath("blog/", language))}>
          {language === "zh" ? "返回博客" : "Back to blog"}
        </a>
      </div>
    );
  const related = posts.filter((entry) => entry.slug !== post.slug).slice(0, 2);
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <a href={asset(blogPath("blog/", language))}>
          {language === "zh" ? "← 全部文章" : "← All articles"}
        </a>
        <h1 tabIndex={-1}>{article.title}</h1>
        <div className={styles.overview}>
          <div className={styles.illustration}>
            <BlogIllustration slug={post.slug} />
          </div>
          <div className={styles.description}>
            <p className={styles.summary}>{article.summary}</p>
            <dl className={styles.meta}>
              <div>
                <dt>{language === "zh" ? "作者" : "Written by"}</dt>
                <dd>{article.author}</dd>
              </div>
              <div>
                <dt>{language === "zh" ? "发布于" : "Published on"}</dt>
                <dd>
                  <time dateTime={article.publishedAt}>
                    {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(article.publishedAt))}
                  </time>
                </dd>
              </div>
              <div>
                <dt>{language === "zh" ? "阅读时长" : "Reading time"}</dt>
                <dd>{readingLabel(article.readingMinutes, language)}</dd>
              </div>
              {article.updatedAt && (
                <div>
                  <dt>{language === "zh" ? "更新于" : "Updated on"}</dt>
                  <dd>
                    <time dateTime={article.updatedAt}>{article.updatedAt}</time>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </header>
      <div className={styles.layout}>
        <BlogBody key={post.slug} post={post} bodies={bodies} />
        {article.headings.length >= 3 && (
          <aside className={styles.toc}>
            <details open>
              <summary>{language === "zh" ? "本文目录" : "On this page"}</summary>
              <nav aria-label={language === "zh" ? "本文目录" : "On this page"}>
                {article.headings.map((heading) => (
                  <a
                    key={heading.id}
                    className={heading.depth === 3 ? styles.tocNested : undefined}
                    href={asset(blogPath(route, language) + "#" + language + "-" + heading.id)}
                  >
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
