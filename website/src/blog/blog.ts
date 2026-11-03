import posts from "virtual:blog-content";

import type { Language } from "../translations";

export const blogPost = (route: string) =>
  posts.find((post) => route === "blog/" + post.slug + "/");

export const categoryLabel = (category: string, language: Language): string =>
  ({
    engineering: language === "zh" ? "工程实践" : "Engineering",
    product: language === "zh" ? "产品思考" : "Product",
    guides: language === "zh" ? "使用指南" : "Guides",
  })[category] ?? category;

export const readingLabel = (minutes: number, language: Language): string =>
  language === "zh" ? "约 " + minutes + " 分钟" : minutes + " min read";
