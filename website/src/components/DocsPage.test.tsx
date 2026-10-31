import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { DocsPage } from "./DocsPage";

afterEach(cleanup);

test("renders versioned documentation with contents and handles unknown pages", () => {
  const view = render(<DocsPage route="docs/0.4.0/web/voice/" />);
  expect(screen.getByRole("navigation", { name: "页内目录" })).toBeTruthy();
  expect(screen.getByText("Loop 0.4.0 · 2026-10-29")).toBeTruthy();
  view.rerender(<DocsPage route="docs/0.4.0/missing/" />);
  expect(screen.getByRole("heading", { name: "文档不存在" })).toBeTruthy();
});
