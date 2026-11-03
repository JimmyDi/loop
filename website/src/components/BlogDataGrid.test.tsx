import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { BlogDataGrid } from "./BlogDataGrid";

afterEach(cleanup);

it("lists every article with linked titles and publication metadata", () => {
  render(
    <LanguageProvider initialLanguage="en">
      <BlogDataGrid posts={posts} />
    </LanguageProvider>,
  );
  const table = screen.getByRole("table", { name: "All articles" });
  expect(within(table).queryAllByRole("columnheader")).toHaveLength(0);
  expect(within(table).getAllByRole("row")).toHaveLength(posts.length);
  for (const post of posts) {
    const link = within(table).getByRole("link", { name: post.en.title });
    expect(link.getAttribute("href")).toBe("/en/blog/" + post.slug + "/");
    const row = link.closest("tr");
    expect(row?.textContent).toContain(post.en.author);
    expect(row?.querySelector("time")?.dateTime).toBe(post.en.publishedAt);
  }
});

it("appends articles and paginates search results independently", () => {
  const manyPosts = Array.from({ length: 25 }, (_, index) => ({
    ...posts[0],
    slug: "article-" + index,
    en: { ...posts[0].en, title: (index < 23 ? "Match " : "Other ") + index },
  }));
  render(
    <LanguageProvider initialLanguage="en">
      <BlogDataGrid posts={manyPosts} />
    </LanguageProvider>,
  );
  const rows = () => within(screen.getByRole("table")).getAllByRole("row");
  const more = () => screen.getByRole("button", { name: "View more" });
  expect(rows()).toHaveLength(10);
  fireEvent.click(more());
  expect(rows()).toHaveLength(20);
  expect(screen.getByRole("link", { name: "Match 0" })).toBeTruthy();
  fireEvent.click(more());
  expect(rows()).toHaveLength(25);
  expect(screen.queryByRole("button", { name: "View more" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Match" } });
  expect(rows()).toHaveLength(10);
  fireEvent.click(more());
  expect(rows()).toHaveLength(20);
  fireEvent.click(more());
  expect(rows()).toHaveLength(23);
  expect(screen.queryByRole("link", { name: "Other 24" })).toBeNull();
  expect(screen.queryByRole("button", { name: "View more" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no match" } });
  expect(screen.getByText("No matching articles. Try another search.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "View more" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(rows()).toHaveLength(10);
});
