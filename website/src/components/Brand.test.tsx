import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Brand } from "./Brand";

afterEach(cleanup);

it("renders an accessible home link with decorative artwork", () => {
  const { container } = render(<Brand />);
  expect(screen.getByRole("link", { name: "Loop 首页" }).getAttribute("href")).toBe("#");
  expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  expect(container.querySelector("img")?.getAttribute("src")).toContain("brand/loop-mark-dark.svg");
  expect(screen.getByRole("link").textContent).toBe("Loop");
});
