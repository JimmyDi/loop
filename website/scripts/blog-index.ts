import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { createArticleIndex } from "../src/blog/article-index.ts";
import type { BlogIndexPost, BlogPost } from "../src/blog/types.ts";

export const readArticleIndex = async (
  directory: string,
  posts: BlogPost[],
): Promise<BlogIndexPost[]> => {
  const source = await readFile(resolve(directory, "index.jsonl"), "utf8");
  const entries = source
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error("Invalid blog index JSON on line " + (index + 1));
      }
    });
  const expected = createArticleIndex(posts);
  if (!isDeepStrictEqual(entries, JSON.parse(JSON.stringify(expected)))) {
    throw new Error(
      "Blog index is stale or invalid. Update content/blog/index.jsonl alongside the article changes.",
    );
  }
  return entries as BlogIndexPost[];
};
