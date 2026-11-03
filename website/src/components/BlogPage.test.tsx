import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";
import { BlogPage } from "./BlogPage";

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
