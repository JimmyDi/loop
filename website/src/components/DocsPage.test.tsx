import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import releases from "virtual:release-content";

import { DocsPage } from "./DocsPage";

afterEach(cleanup);

test("renders latest documentation with contents and handles unknown pages", () => {
  const view = render(<DocsPage route="docs/web/voice/" />);
  expect(screen.getByRole("navigation", { name: "页内目录" })).toBeTruthy();
  expect(screen.getByText(`Loop ${releases[0].version} · ${releases[0].date}`)).toBeTruthy();
  view.rerender(<DocsPage route="docs/missing/" />);
  expect(screen.getByRole("heading", { name: "文档不存在" })).toBeTruthy();
});
