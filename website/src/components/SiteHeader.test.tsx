import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { translations } from "../translations";
import { SiteHeader } from "./SiteHeader";

afterEach(cleanup);

it("places the repository link before the language switch beside the brand", () => {
  const { container } = render(<SiteHeader />);
  const brand = screen.getByRole("link", { name: "Loop 首页" });
  expect(brand.getAttribute("href")).toBe("/");
  const repository = screen.getByRole("link", { name: translations.zh.githubRepository });
  expect(repository.getAttribute("href")).toBe("https://github.com/JimmyDi/loop");
  expect(repository.getAttribute("target")).toBe("_blank");
  expect(repository.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getAllByRole("link")).toEqual([
    brand,
    screen.getByRole("link", { name: translations.zh.docs }),
    screen.getByRole("link", { name: translations.zh.changelog }),
    repository,
  ]);
  expect(repository.nextElementSibling).toBe(screen.getByRole("group", { name: "网站语言" }));
  expect(screen.getByRole("navigation")).toBeTruthy();
  expect(brand.querySelector("img")?.getAttribute("src")).toContain("brand/loop-mark-dark.svg");
  expect(brand.querySelector("img")?.getAttribute("width")).toBe("48");
  expect(brand.textContent).toBe("Loop");
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(screen.getByRole("group", { name: "网站语言" })).toBeTruthy();
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["中文", "EN"]);
});

it("updates the repository accessible label and tooltip when the language changes", () => {
  render(
    <LanguageProvider initialLanguage="zh">
      <SiteHeader />
    </LanguageProvider>,
  );
  const repository = screen.getByRole("link", { name: translations.zh.githubRepository });
  expect(repository.title).toBe(translations.zh.githubRepository);
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getByRole("link", { name: translations.en.githubRepository })).toBe(repository);
  expect(repository.title).toBe(translations.en.githubRepository);
  expect(screen.getByRole("link", { name: translations.en.docs }).getAttribute("href")).toBe(
    "/docs/",
  );
  expect(screen.getByRole("link", { name: translations.en.changelog }).getAttribute("href")).toBe(
    "/changelog/",
  );
  expect(screen.getByRole("navigation", { name: translations.en.mainNavigation })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(repository.getAttribute("aria-label")).toBe(translations.zh.githubRepository);
  expect(screen.getByRole("link", { name: translations.zh.docs })).toBeTruthy();
  expect(screen.getByRole("link", { name: translations.zh.changelog })).toBeTruthy();
});
