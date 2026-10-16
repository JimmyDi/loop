import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { ProductPreview } from "./ProductPreview";

afterEach(cleanup);

it("embeds a real app screenshot with fictional-data disclosure and no playback", () => {
  const { container } = render(<ProductPreview />);
  expect(container.querySelector("[aria-label]")?.getAttribute("aria-label")).toContain(
    "虚构工程项目",
  );
  expect(screen.getByRole("img").getAttribute("src")).toContain(
    "product/storefront-filters-zh-light.webp",
  );
  expect(container.querySelector("[data-pointer-clear]")?.contains(screen.getByRole("img"))).toBe(
    true,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(container.querySelector("video")).toBeNull();
});
