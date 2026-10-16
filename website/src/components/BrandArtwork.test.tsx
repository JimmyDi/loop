import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { BrandArtwork } from "./BrandArtwork";

afterEach(cleanup);

it("provides native theme-aware decorative product artwork", () => {
  const { container } = render(<BrandArtwork size={48} />);
  const source = container.querySelector("source");
  const image = container.querySelector("img");
  expect(source?.media).toBe("(prefers-color-scheme: dark)");
  expect(source?.srcset).toContain("loop-mark-white.svg");
  expect(image?.getAttribute("src")).toContain("loop-mark-dark.svg");
  expect(image?.alt).toBe("");
  expect(image?.width).toBe(48);
  expect(image?.height).toBe(48);
});
