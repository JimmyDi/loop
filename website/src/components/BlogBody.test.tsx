import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { BlogBody } from "./BlogBody";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("copies the code associated with the selected block", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(
    <LanguageProvider initialLanguage="en">
      <BlogBody
        post={posts[0]}
        bodies={{
          en: "<pre><button data-copy-code>Copy code</button><code>const value = 42;</code></pre>",
        }}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("const value = 42;"));
  expect(screen.getByRole("status").textContent).toBe("Code copied");
});

it("keeps static and fetched section IDs stable across rendering", () => {
  const { container } = render(
    <LanguageProvider initialLanguage="en">
      <BlogBody post={posts[0]} bodies={{ en: '<h2 id="en-section">Section</h2>' }} />
    </LanguageProvider>,
  );
  expect(container.querySelector('[data-blog-body="en"] h2')?.id).toBe("en-section");
  expect(container.querySelectorAll("#en-section")).toHaveLength(1);
});

it("opens an article image and returns focus to its control on close", () => {
  render(
    <LanguageProvider initialLanguage="en">
      <BlogBody
        post={posts[0]}
        bodies={{
          en: '<button type="button" data-enlarge-image aria-label="Enlarge diagram"><img src="/diagram.png" alt="Diagram"></button>',
        }}
      />
    </LanguageProvider>,
  );
  const opener = screen.getByRole("button", { name: "Enlarge diagram" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog");
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(dialog.querySelector("img")?.src).toBe(opener.querySelector("img")?.src);
  fireEvent.click(screen.getByRole("button", { name: "Close image" }));
  expect(document.activeElement).toBe(opener);
});

it("enlarges the image source selected by the browser theme", () => {
  render(
    <LanguageProvider initialLanguage="en">
      <BlogBody
        post={posts[0]}
        bodies={{
          en: '<button type="button" data-enlarge-image aria-label="Enlarge diagram"><picture><source media="(prefers-color-scheme: dark)" srcset="/diagram-dark.png"><img src="/diagram.png" alt="Diagram"></picture></button>',
        }}
      />
    </LanguageProvider>,
  );
  const opener = screen.getByRole("button", { name: "Enlarge diagram" });
  Object.defineProperty(opener.querySelector("img"), "currentSrc", {
    value: "https://example.com/diagram-dark.png",
  });
  fireEvent.click(opener);
  expect(screen.getByRole("dialog").querySelector("img")?.src).toBe(
    "https://example.com/diagram-dark.png",
  );
});

it("keeps image assets under the deployment root while localizing article links", async () => {
  const { setPrerenderAssetBase } = await import("../assets");
  setPrerenderAssetBase("/loop/");
  try {
    const { container } = render(
      <LanguageProvider initialLanguage="en">
        <BlogBody
          post={posts[0]}
          bodies={{
            en: '<img src="blog/post/image.png" alt="Diagram"><a href="blog/post/">Related</a>',
          }}
        />
      </LanguageProvider>,
    );
    expect(container.querySelector('[data-blog-body="en"] img')?.getAttribute("src")).toBe(
      "/loop/blog/post/image.png",
    );
    expect(screen.getByRole("link", { name: "Related" }).getAttribute("href")).toBe(
      "/loop/en/blog/post/",
    );
  } finally {
    setPrerenderAssetBase("/");
  }
});
