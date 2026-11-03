import type { BlogArticle, BlogIndexPost, BlogPost } from "./types";

export const createArticleIndex = (posts: BlogPost[]): BlogIndexPost[] =>
  posts.map(({ slug, zh, en }) => {
    const metadata = ({ html: _html, headings: _headings, ...article }: BlogArticle) => article;
    return { slug, zh: metadata(zh), en: metadata(en) };
  });
