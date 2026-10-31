import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ChangelogPage } from "./ChangelogPage";

afterEach(cleanup);

test("lists published summaries and renders individual release notes", () => {
  const view = render(<ChangelogPage route="changelog/" />);
  expect(screen.getByRole("heading", { name: "Loop 0.4.0" })).toBeTruthy();
  expect(screen.queryByText("Unreleased")).toBeNull();
  view.rerender(<ChangelogPage route="changelog/0.3.1/" />);
  expect(screen.getByRole("heading", { name: "Loop 0.3.1" })).toBeTruthy();
  expect(screen.getByText(new RegExp("@loop-harness/loop"))).toBeTruthy();
});
