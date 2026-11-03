import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { BlogArticle } from "./BlogArticle";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("changes the complete article with the shared language switch and reports copy failure", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  render(
    <LanguageProvider initialLanguage="zh">
      <LanguageSwitch />
      <BlogArticle route={"blog/" + posts[0].slug + "/"} />
    </LanguageProvider>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(posts[0].zh.title);
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(posts[0].en.title);
  expect(screen.getByRole("heading", { name: posts[0].en.headings[0].title })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: posts[0].zh.headings[0].title })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() =>
    expect(
      screen.getAllByRole("status").some((node) => node.textContent?.includes("Copy failed")),
    ).toBe(true),
  );
});

it("shows a missing article instead of the homepage", () => {
  render(
    <LanguageProvider initialLanguage="en">
      <BlogArticle route="blog/unknown/" />
    </LanguageProvider>,
  );
  expect(screen.getByRole("heading").textContent).toBe("Article not found");
  expect(screen.getByRole("link").getAttribute("href")).toBe("/blog/");
});
