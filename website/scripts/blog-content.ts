import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { BlogArticle, BlogLocale, BlogPost } from "../src/blog/types.ts";
import { renderBlogMarkdown } from "./blog-markdown.ts";

const validDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

export const parseBlogSource = (
  source: string,
  filename: string,
  publicRoot: string,
): BlogArticle & { draft: boolean } => {
  const match = filename.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\.(zh|en)\.md$/);
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match || !frontmatter) throw new Error("Invalid blog filename or frontmatter: " + filename);
  const metadata: Record<string, string | boolean> = {};
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (!field || field[1] in metadata)
      throw new Error("Invalid or duplicate blog field: " + filename);
    const value = field[2].trim();
    metadata[field[1]] =
      value === "true"
        ? true
        : value === "false"
          ? false
          : value.startsWith('"')
            ? JSON.parse(value)
            : value;
  }
  const allowed = ["title", "summary", "author", "category", "publishedAt", "updatedAt", "draft"];
  if (Object.keys(metadata).some((key) => !allowed.includes(key)))
    throw new Error("Unknown blog field: " + filename);
  const required = (key: string): string => {
    const value = metadata[key];
    if (typeof value !== "string" || !value.trim())
      throw new Error("Missing blog " + key + ": " + filename);
    return value;
  };
  const publishedAt = required("publishedAt");
  const updatedAt = metadata.updatedAt === undefined ? undefined : required("updatedAt");
  if (!validDate(publishedAt) || (updatedAt && (!validDate(updatedAt) || updatedAt < publishedAt)))
    throw new Error("Invalid blog date: " + filename);
  const category = required("category");
  if (!["engineering", "product", "guides"].includes(category))
    throw new Error("Invalid blog category: " + filename);
  if (typeof metadata.draft !== "boolean")
    throw new Error("Blog draft must be explicit: " + filename);
  const [slug, language] = match.slice(1);
  const body = frontmatter[2];
  const words = body.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu)?.length ?? 0;
  return {
    slug,
    language: language as BlogLocale,
    title: required("title"),
    summary: required("summary"),
    author: required("author"),
    category: category as BlogArticle["category"],
    publishedAt,
    updatedAt,
    draft: metadata.draft,
    readingMinutes: Math.max(1, Math.ceil(words / (language === "zh" ? 400 : 220))),
    ...renderBlogMarkdown(body, slug, publicRoot, language),
  };
};

export const readBlogContent = async (
  directory: string,
  publicRoot: string,
): Promise<BlogPost[]> => {
  const groups = new Map<string, Partial<Record<BlogLocale, BlogArticle & { draft: boolean }>>>();
  for (const file of (await readdir(directory)).filter((file) => file.endsWith(".md")).sort()) {
    const article = parseBlogSource(
      await readFile(resolve(directory, file), "utf8"),
      file,
      publicRoot,
    );
    const group = groups.get(article.slug) ?? {};
    if (group[article.language]) throw new Error("Duplicate blog locale: " + file);
    group[article.language] = article;
    groups.set(article.slug, group);
  }
  const posts: BlogPost[] = [];
  for (const [slug, group] of groups) {
    if (Object.values(group).every((article) => article.draft)) continue;
    if (!group.zh || !group.en || group.zh.draft || group.en.draft)
      throw new Error("Public blog requires both languages: " + slug);
    if (
      ["publishedAt", "updatedAt", "category", "author"].some(
        (key) => group.zh![key as keyof BlogArticle] !== group.en![key as keyof BlogArticle],
      )
    )
      throw new Error("Blog pair metadata differs: " + slug);
    const { draft: _zhDraft, ...zh } = group.zh;
    const { draft: _enDraft, ...en } = group.en;
    posts.push({ slug, zh, en });
  }
  return posts.sort(
    (a, b) => b.zh.publishedAt.localeCompare(a.zh.publishedAt) || a.slug.localeCompare(b.slug),
  );
};
