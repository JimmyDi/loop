import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { BlogArticle } from "./BlogArticle";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("changes the complete article and labeled metadata with the shared language switch", () => {
  render(
    <LanguageProvider initialLanguage="zh">
      <LanguageSwitch />
      <BlogArticle route={"blog/" + posts[0].slug + "/"} />
    </LanguageProvider>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(posts[0].zh.title);
  expect(screen.getByRole("img", { name: "本地语音输入插画" })).toBeTruthy();
  const author = screen.getByText("作者").closest("div");
  expect(author?.querySelector("dd")?.textContent).toBe(posts[0].zh.author);
  const publication = screen.getByText("发布于").closest("div");
  expect(publication?.querySelector("time")?.dateTime).toBe("2026-01-01");
  expect(publication?.querySelector("time")?.textContent).toBe("2026年1月1日");
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getByRole("img", { name: "Local voice input illustration" })).toBeTruthy();
  expect(screen.getByText("Written by").closest("div")?.querySelector("dd")?.textContent).toBe(
    posts[0].en.author,
  );
  expect(screen.getByText("Published on").closest("div")?.querySelector("time")?.textContent).toBe(
    "January 1, 2026",
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(posts[0].en.title);
  expect(screen.getByRole("heading", { name: posts[0].en.headings[0].title })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: posts[0].zh.headings[0].title })).toBeNull();
});

it("shows a missing article instead of the homepage", () => {
  render(
    <LanguageProvider initialLanguage="en">
      <BlogArticle route="blog/unknown/" />
    </LanguageProvider>,
  );
  expect(screen.getByRole("heading").textContent).toBe("Article not found");
  expect(screen.getByRole("link").getAttribute("href")).toBe("/en/blog/");
});
