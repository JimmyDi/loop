import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { SiteHeader } from "./SiteHeader";

afterEach(cleanup);

it("keeps only the brand home link and language switch in the header", () => {
  const { container } = render(<SiteHeader />);
  const brand = screen.getByRole("link", { name: "Loop 首页" });
  expect(brand.getAttribute("href")).toBe("#");
  expect(screen.getAllByRole("link")).toEqual([brand]);
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(brand.querySelector("img")?.getAttribute("src")).toContain("brand/loop-mark-dark.svg");
  expect(brand.querySelector("img")?.getAttribute("width")).toBe("48");
  expect(brand.textContent).toBe("Loop");
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(screen.getByRole("group", { name: "网站语言" })).toBeTruthy();
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["中文", "EN"]);
});
