import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageProvider";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  history.replaceState(null, "", "/");
});

it("translates the complete page without resetting the selected interface or removing commands", () => {
  vi.stubGlobal("navigator", { languages: ["zh-CN"], language: "zh-CN" });
  const { container } = render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /CLI/ }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  const body = container.cloneNode(true) as HTMLElement;
  for (const button of body.querySelectorAll('button[lang="zh-CN"]')) button.remove();
  expect(body.textContent).not.toMatch(/[一-鿿]/u);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("reality.");
  expect(container.querySelector<HTMLElement>("#panel-cli")?.hidden).toBe(false);
  expect(screen.getAllByRole("button", { name: "Copy startup command" })).toHaveLength(1);
  expect(container.querySelector("#start")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("实现。");
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')) {
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  }
});

it("switches Home, Docs and Changelog while keeping the header and language mounted", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  history.replaceState(null, "", "/");
  const view = render(
    <LanguageProvider initialLanguage="en">
      <App />
    </LanguageProvider>,
  );
  const header = view.container.querySelector("header");
  fireEvent.click(within(header!).getByRole("link", { name: "Docs" }));
  await waitFor(() => expect(location.pathname).toBe("/docs/"));
  expect(screen.getByRole("navigation", { name: "Documentation navigation" })).toBeTruthy();
  expect(view.container.querySelector("header")).toBe(header);
  fireEvent.click(within(header!).getByRole("link", { name: "Changelog" }));
  await waitFor(() => expect(location.pathname).toBe("/changelog/"));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Every release");
  expect(view.container.querySelector("header")).toBe(header);
  fireEvent.click(screen.getByRole("link", { name: "Loop home" }));
  await waitFor(() => expect(location.pathname).toBe("/"));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("reality.");
  expect(view.container.querySelector("header")).toBe(header);
});

it("retains fetched bilingual blog bodies after the browser URL changes", async () => {
  const posts = (await import("virtual:blog-content")).default;
  const post = posts[0];
  const clientPosts = posts.map((entry) => ({ zh: entry.zh.html, en: entry.en.html }));
  for (const entry of posts) {
    entry.zh.html = "";
    entry.en.html = "";
  }
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<div data-blog-body="zh"><h2>中文正文</h2></div><div data-blog-body="en"><h2>English body</h2></div>',
        ),
      ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  history.replaceState(null, "", "/blog/");
  try {
    render(
      <LanguageProvider initialLanguage="en">
        <App />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getAllByRole("link", { name: new RegExp(post.en.title) })[0]);
    await waitFor(() => expect(screen.getByRole("heading", { name: "English body" })).toBeTruthy());
    expect(location.pathname).toBe("/en/blog/" + post.slug + "/");
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("heading", { name: "中文正文" })).toBeTruthy();
  } finally {
    posts.forEach((entry, index) => {
      entry.zh.html = clientPosts[index].zh;
      entry.en.html = clientPosts[index].en;
    });
  }
});

it("opens an explicit English blog URL and updates URL and metadata when switching language", async () => {
  history.replaceState(null, "", "/en/blog/test-article/");
  vi.stubGlobal("navigator", { languages: ["zh-CN"], language: "zh-CN" });
  render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Test article test-article");
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(location.pathname).toBe("/blog/test-article/");
  expect(document.documentElement.lang).toBe("zh-CN");
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(location.pathname).toBe("/en/blog/test-article/");
  expect(document.documentElement.lang).toBe("en");
});
