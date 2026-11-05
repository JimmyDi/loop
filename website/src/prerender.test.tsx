import { expect, it, vi } from "vitest";

import { render } from "./prerender";

vi.mock("virtual:blog-content", () => ({
  default: ["test-article", "another-article"].map((slug) => {
    const article = (language: "zh" | "en") => ({
      slug,
      language,
      title: (language === "zh" ? "测试文章 " : "Test article ") + slug,
      summary: language === "zh" ? "测试摘要" : "Synthetic summary",
      author: "Loop",
      category: "engineering" as const,
      publishedAt: "2026-01-01",
      readingMinutes: 1,
      html:
        language === "zh"
          ? '<h2 id="section">测试章节</h2><p>测试正文</p>'
          : '<h2 id="section">Test section</h2><p>Synthetic body</p>',
      headings: [{ id: "section", title: language === "zh" ? "测试章节" : "Test section" }],
    });
    return { slug, zh: article("zh"), en: article("en") };
  }),
}));

it.each(["./", "/loop/"])("renders complete static content with asset base %s", (base) => {
  const html = render(base);
  expect(html).toContain("npx @loop-harness/loop web");
  expect(html).toContain("35 个 provider");
  expect(html).toContain("从想法，");
  expect(html).toContain('id="main"');
  expect(html).toContain('aria-live="polite"');
  expect(html).not.toContain("undefined");
  expect(html).toContain('src="' + base + 'brand/loop-mark-dark.svg"');
  expect(html).toContain('srcSet="' + base + 'brand/loop-mark-white.svg"');
  expect(html).toContain('media="(prefers-color-scheme: dark)"');
});

it("renders both complete blog translations without depending on client article bodies", () => {
  const html = render("/loop/", "en", "blog/test-article/");
  expect(html).toContain("Test section");
  expect(html).toContain("测试章节");
  expect(html).toContain('id="en-section"');
  expect(html).toContain('href="/loop/en/blog/"');
  expect(render("/", "en", "blog/missing/")).toContain("Article not found");
});
