import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { translations } from "../translations";
import { SiteHeader } from "./SiteHeader";

afterEach(cleanup);

it("places the repository link before the language switch beside the brand", () => {
  const { container } = render(<SiteHeader />);
  const brand = screen.getByRole("link", { name: "Loop 首页" });
  expect(brand.getAttribute("href")).toBe("#");
  const repository = screen.getByRole("link", { name: translations.githubRepository.zh });
  expect(repository.getAttribute("href")).toBe("https://github.com/JimmyDi/loop");
  expect(repository.getAttribute("target")).toBe("_blank");
  expect(repository.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getAllByRole("link")).toEqual([brand, repository]);
  expect(repository.nextElementSibling).toBe(screen.getByRole("group", { name: "网站语言" }));
  expect(screen.queryByRole("navigation")).toBeNull();
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
  const repository = screen.getByRole("link", { name: translations.githubRepository.zh });
  expect(repository.title).toBe(translations.githubRepository.zh);
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(screen.getByRole("link", { name: translations.githubRepository.en })).toBe(repository);
  expect(repository.title).toBe(translations.githubRepository.en);
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(repository.getAttribute("aria-label")).toBe(translations.githubRepository.zh);
});
