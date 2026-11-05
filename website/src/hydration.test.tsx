import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageProvider";
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

it.each(["zh", "en"] as const)(
  "hydrates preselected %s markup without a language flash",
  async (language) => {
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    const host = document.createElement("div");
    host.innerHTML = render("/", language);
    const heading = host.querySelector("h1")?.textContent;
    document.body.append(host);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          host,
          <LanguageProvider initialLanguage={language}>
            <App />
          </LanguageProvider>,
          { onRecoverableError },
        );
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(host.querySelector("h1")?.textContent).toBe(heading);
    } finally {
      await act(async () => root?.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  },
);

it.each(["zh", "en"] as const)(
  "hydrates the static %s blog body and switches languages",
  async (language) => {
    const host = document.createElement("div");
    host.id = "root";
    host.innerHTML = render("/", language, "blog/test-article/");
    document.body.append(host);
    const errors = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          host,
          <LanguageProvider initialLanguage={language}>
            <App path="blog/test-article/" />
          </LanguageProvider>,
          { onRecoverableError: errors },
        );
      });
      expect(errors).not.toHaveBeenCalled();
      expect(host.querySelector('[data-blog-body="en"]')?.textContent).toContain("Test section");
      expect(host.querySelector('[data-blog-body="zh"]')?.textContent).toContain("测试章节");
    } finally {
      await act(async () => root?.unmount());
      host.remove();
    }
  },
);
