import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { BlogCard } from "./BlogCard";

afterEach(cleanup);

it("links the complete featured card to its article with semantic publication metadata", () => {
  const article = posts[0].en;
  const { container } = render(
    <LanguageProvider initialLanguage="en">
      <BlogCard article={article} featured />
    </LanguageProvider>,
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe("/blog/" + article.slug + "/");
  expect(screen.getByRole("heading").textContent).toBe(article.title);
  expect(container.querySelector("time")?.dateTime).toBe(article.publishedAt);
  expect(screen.getByText(/Latest/)).toBeTruthy();
});

it("shows the illustration on expanded cards and keeps article information on compact cards", () => {
  const article = posts[1].en;
  const view = (featured: boolean) => (
    <LanguageProvider initialLanguage="en">
      <BlogCard article={article} featured={featured} />
    </LanguageProvider>
  );
  const { container, rerender } = render(view(true));
  expect(screen.getByText(/Latest/)).toBeTruthy();
  expect(screen.getByText(article.summary)).toBeTruthy();
  expect(screen.getByText("Input → Execute → Result")).toBeTruthy();
  rerender(view(false));
  expect(screen.queryByText("Input → Execute → Result")).toBeNull();
  expect(screen.getByRole("heading").textContent).toBe(article.title);
  expect(screen.getByText(article.summary)).toBeTruthy();
  expect(container.querySelector("time")?.dateTime).toBe(article.publishedAt);
});
