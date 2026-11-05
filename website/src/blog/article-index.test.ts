import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import posts from "virtual:blog-content";
import index from "virtual:blog-index";

import { readArticleIndex } from "../../scripts/blog-index";
import { createArticleIndex } from "./article-index";

it("indexes bilingual listing metadata in publication order without article bodies or headings", () => {
  expect(index).toEqual(createArticleIndex(posts));
  expect(index.map((post) => post.slug)).toEqual(posts.map((post) => post.slug));
  for (const [position, post] of index.entries()) {
    for (const language of ["zh", "en"] as const) {
      expect(post[language].title).toBe(posts[position][language].title);
      expect(post[language].publishedAt).toBe(posts[position][language].publishedAt);
      expect(post[language]).not.toHaveProperty("html");
      expect(post[language]).not.toHaveProperty("headings");
    }
  }
});

it("reads the maintained JSONL index and rejects malformed, missing, duplicate or stale records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-blog-index-"));
  const file = join(directory, "index.jsonl");
  const fixturePosts = ["first", "second"].map((slug) => {
    const article = (language: "zh" | "en") => ({
      slug,
      language,
      title: "Synthetic " + slug,
      summary: "Synthetic summary",
      author: "Loop",
      category: "engineering" as const,
      publishedAt: "2026-01-01",
      readingMinutes: 1,
      html: "<p>Synthetic body</p>",
      headings: [],
    });
    return { slug, zh: article("zh"), en: article("en") };
  });
  const records = createArticleIndex(fixturePosts);
  const write = (value: unknown[]) =>
    writeFile(file, value.map((entry) => JSON.stringify(entry)).join("\n"));
  try {
    await expect(readArticleIndex(directory, fixturePosts)).rejects.toThrow();
    await write(records);
    expect(await readArticleIndex(directory, fixturePosts)).toEqual(records);
    for (const invalid of [
      records.slice(1),
      [...records, records[0]],
      [...records].reverse(),
      records.map((post, index) =>
        index ? post : { ...post, en: { ...post.en, title: "Stale title" } },
      ),
    ]) {
      await write(invalid);
      await expect(readArticleIndex(directory, fixturePosts)).rejects.toThrow(
        "Update content/blog/index.jsonl",
      );
    }
    await writeFile(file, "invalid JSON");
    await expect(readArticleIndex(directory, fixturePosts)).rejects.toThrow("line 1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
