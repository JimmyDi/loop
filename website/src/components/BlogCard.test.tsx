import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { BlogCard } from "./BlogCard";

vi.mock("virtual:blog-content", () => ({
  default: ["local-voice-167-mib", "another-article"].map((slug) => {
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

afterEach(cleanup);

it("links the complete featured card to its article with semantic publication metadata", () => {
  const article = posts[0].en;
  const { container } = render(
    <LanguageProvider initialLanguage="en">
      <BlogCard article={article} featured />
    </LanguageProvider>,
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe("/en/blog/" + article.slug + "/");
  expect(screen.getByRole("heading").textContent).toBe(article.title);
  expect(container.querySelector("time")?.dateTime).toBe(article.publishedAt);
  expect(screen.getByText(/Latest/)).toBeTruthy();
});

it("shows the illustration on expanded cards and keeps article information on compact cards", () => {
  const article = posts[0].en;
  const view = (featured: boolean) => (
    <LanguageProvider initialLanguage="en">
      <BlogCard article={article} featured={featured} />
    </LanguageProvider>
  );
  const { container, rerender } = render(view(true));
  expect(screen.getByText(/Latest/)).toBeTruthy();
  expect(screen.getByText(article.summary)).toBeTruthy();
  expect(screen.getByRole("img", { name: "Local voice input illustration" })).toBeTruthy();
  rerender(view(false));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByRole("heading").textContent).toBe(article.title);
  expect(screen.getByText(article.summary)).toBeTruthy();
  expect(container.querySelector("time")?.dateTime).toBe(article.publishedAt);
});
