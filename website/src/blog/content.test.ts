import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

import { parseBlogSource, readBlogContent } from "../../scripts/blog-content";
import { renderBlogMarkdown } from "../../scripts/blog-markdown";

const source = (extra = "", body = "## Section\n\nBody") =>
  "---\ntitle: A title\nsummary: A summary\nauthor: Loop\ncategory: engineering\npublishedAt: 2026-11-03\ndraft: false\n" +
  extra +
  "---\n" +
  body;
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

it("validates explicit publication, dates, metadata and language pairs", async () => {
  expect(() =>
    parseBlogSource(source().replace("2026-11-03", "2026-02-30"), "post.en.md", "."),
  ).toThrow("date");
  expect(() => parseBlogSource(source("title: Duplicate\n"), "post.en.md", ".")).toThrow(
    "duplicate",
  );
  expect(() => parseBlogSource(source().replace("draft: false\n", ""), "post.en.md", ".")).toThrow(
    "explicit",
  );
  const path = await mkdtemp(join(tmpdir(), "loop-blog-"));
  directories.push(path);
  await writeFile(join(path, "post.zh.md"), source());
  await expect(readBlogContent(path, path)).rejects.toThrow("both languages");
  await writeFile(join(path, "post.en.md"), source());
  expect(await readBlogContent(path, path)).toHaveLength(1);
  await writeFile(join(path, "draft.en.md"), source().replace("draft: false", "draft: true"));
  expect(await readBlogContent(path, path)).toHaveLength(1);
});

it("removes raw HTML and unsafe links, escapes code and generates unique section anchors", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const body =
    "<script>alert(1)</script>\n\n[bad](javascript:alert) [good](https://example.com)\n\n## Same\n\n## Same\n\n" +
    fence +
    "html\n<img onerror=alert(1)>\n" +
    fence;
  const rendered = renderBlogMarkdown(body, "post", ".");
  expect(rendered.html).not.toContain("<script>");
  expect(rendered.html).not.toContain('href="javascript:');
  expect(rendered.html).toContain('href="https://example.com"');
  expect(rendered.html).toContain("&lt;img onerror=alert(1)>");
  expect(rendered.headings.map((heading) => heading.id)).toEqual(["same", "same-1"]);
  expect(rendered.html).toContain("data-copy-code");
});

it("requires local image assets and prevents escaping the article asset directory", async () => {
  const path = await mkdtemp(join(tmpdir(), "loop-blog-"));
  directories.push(path);
  await mkdir(join(path, "blog/post"), { recursive: true });
  await writeFile(join(path, "blog/post/image.png"), "synthetic");
  expect(renderBlogMarkdown("![Diagram](image.png)", "post", path).html).toContain(
    'src="blog/post/image.png"',
  );
  expect(() => renderBlogMarkdown("![Diagram](../image.png)", "post", path)).toThrow();
  expect(() => renderBlogMarkdown("![](image.png)", "post", path)).toThrow();
  expect(() =>
    renderBlogMarkdown("![Remote](https://example.com/image.png)", "post", path),
  ).toThrow();
});
