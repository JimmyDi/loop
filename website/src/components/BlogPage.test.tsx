import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { BlogPage } from "./BlogPage";

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

vi.mock("virtual:blog-index", async () => ({
  default: (await import("virtual:blog-content")).default.map(({ slug, zh, en }) => {
    const metadata = ({ html: _html, headings: _headings, ...article }: typeof zh) => article;
    return { slug, zh: metadata(zh), en: metadata(en) };
  }),
}));

afterEach(cleanup);

it("searches the table independently of cards and uses the website language", () => {
  const { container } = render(
    <LanguageProvider initialLanguage="zh">
      <LanguageSwitch />
      <BlogPage />
    </LanguageProvider>,
  );
  expect(container.querySelectorAll("article")).toHaveLength(posts.length);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(posts.length);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: posts[0].zh.title } });
  expect(container.querySelectorAll("article")).toHaveLength(posts.length);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-article" } });
  expect(screen.getByText("没有找到相关文章，请尝试其他关键词。")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getAllByRole("heading", { name: posts[0].en.title })[0]).toBeTruthy();
  expect(screen.getByRole("table", { name: "All articles" })).toBeTruthy();
  expect(
    within(screen.getByRole("table")).getByRole("link", { name: posts[0].en.title }),
  ).toBeTruthy();
  expect(screen.getByRole("searchbox").getAttribute("placeholder")).toBe("Search articles");
});
