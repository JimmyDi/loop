import posts from "virtual:blog-index";

import { useLanguage } from "../i18n/useLanguage";
import { BlogCard } from "./BlogCard";
import { BlogDataGrid } from "./BlogDataGrid";
import styles from "./BlogPage.module.css";

export const BlogPage = () => {
  const { language } = useLanguage();
  return (
    <section className={styles.page} aria-label={language === "zh" ? "博客文章" : "Blog articles"}>
      <h1 className={styles.srOnly} tabIndex={-1}>
        {language === "zh" ? "博客" : "Blog"}
      </h1>
      <div className={styles.grid}>
        {posts.map((post) => (
          <BlogCard
            key={post.slug}
            article={post[language]}
            featured={post.slug === posts[0]?.slug}
          />
        ))}
      </div>
      <BlogDataGrid posts={posts} />
    </section>
  );
};
