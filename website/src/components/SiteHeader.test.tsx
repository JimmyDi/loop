import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { SiteHeader } from "./SiteHeader";

afterEach(cleanup);

it("places the repository link before the language switch beside the brand", () => {
  const { container } = render(<SiteHeader />);
  const brand = screen.getByRole("link", { name: "Loop 首页" });
  expect(brand.getAttribute("href")).toBe("#");
  const repository = screen.getByRole("link", { name: "Loop GitHub" });
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
