import { asset } from "../assets";
import { categoryLabel, readingLabel } from "../blog/blog";
import type { BlogIndexArticle } from "../blog/types";
import { useLanguage } from "../i18n/useLanguage";
import styles from "./BlogCard.module.css";

export const BlogCard = ({
  article,
  featured = false,
}: {
  article: BlogIndexArticle;
  featured?: boolean;
}) => {
  const { language } = useLanguage();
  return (
    <article className={[styles.card, featured ? styles.featured : ""].join(" ")}>
      <a className={styles.link} href={asset("blog/" + article.slug + "/")}>
        <div className={styles.meta}>
          <span>
            {featured && (language === "zh" ? "最新 · " : "Latest · ")}
            {categoryLabel(article.category, language)}
          </span>
          <time dateTime={article.publishedAt}>{article.publishedAt}</time>
        </div>
        <div className={styles.body}>
          <div className={styles.copy}>
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
            <div className={styles.byline}>
              {article.author} · {readingLabel(article.readingMinutes, language)}
            </div>
          </div>
          {featured && (
            <div className={styles.art} aria-hidden="true">
              <div className={styles.orbit}>LOOP</div>
              <span>{language === "zh" ? "输入 → 执行 → 结果" : "Input → Execute → Result"}</span>
            </div>
          )}
        </div>
      </a>
    </article>
  );
};
