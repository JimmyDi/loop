import { existsSync, readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it } from "vitest";

import { ProductScreenshot } from "./ProductScreenshot";

afterEach(cleanup);

it("renders native theme-aware screenshots and switches language without playback", () => {
  const { container, rerender } = render(<ProductScreenshot language="zh" label="商品筛选" />);
  expect(screen.getByRole("img").getAttribute("src")).toContain(
    "product/storefront-filters-zh-light.webp",
  );
  expect(container.querySelector("source")?.getAttribute("media")).toBe(
    "(prefers-color-scheme: dark)",
  );
  expect(container.querySelector("source")?.getAttribute("srcset")).toContain(
    "storefront-filters-zh-dark.webp",
  );
  rerender(<ProductScreenshot language="en" label="Storefront filters" />);
  expect(screen.getByRole("img").getAttribute("src")).toContain("storefront-filters-en-light.webp");
  expect(container.querySelector("video, canvas, button")).toBeNull();
  expect(renderToString(<ProductScreenshot language="en" label="Storefront filters" />)).toContain(
    "storefront-filters-en-dark.webp",
  );
});

it("ships bounded independent screenshots for both languages and themes", () => {
  for (const language of ["zh", "en"]) {
    for (const theme of ["light", "dark"]) {
      const path = `public/product/storefront-filters-${language}-${theme}.webp`;
      expect(existsSync(path)).toBe(true);
      const image = readFileSync(path);
      expect(image.subarray(8, 12).toString()).toBe("WEBP");
      expect(image.length).toBeLessThan(250_000);
    }
  }
});
