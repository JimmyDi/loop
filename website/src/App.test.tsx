import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageProvider";

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
  body.querySelector('[lang="zh-CN"]')?.remove();
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
    expect(location.pathname).toBe("/blog/" + post.slug + "/");
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("heading", { name: "中文正文" })).toBeTruthy();
  } finally {
    posts.forEach((entry, index) => {
      entry.zh.html = clientPosts[index].zh;
      entry.en.html = clientPosts[index].en;
    });
  }
});
