export type BlogLocale = "zh" | "en";

export type BlogArticle = {
  slug: string;
  language: BlogLocale;
  title: string;
  summary: string;
  author: string;
  category: "engineering" | "product" | "guides";
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  html: string;
  headings: { id: string; title: string; depth: number }[];
};

export type BlogPost = { slug: string; zh: BlogArticle; en: BlogArticle };

export type BlogBodies = Partial<Record<BlogLocale, string>>;

export type BlogIndexArticle = Omit<BlogArticle, "html" | "headings">;

export type BlogIndexPost = { slug: string; zh: BlogIndexArticle; en: BlogIndexArticle };
