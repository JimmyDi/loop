import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import releases from "virtual:release-content";

import { ChangelogPage } from "./ChangelogPage";

afterEach(cleanup);

test("lists published summaries and renders individual release notes", () => {
  const view = render(<ChangelogPage route="changelog/" />);
  for (const release of releases.slice(0, 5)) {
    expect(screen.getByRole("heading", { name: release.title })).toBeTruthy();
  }
  if (releases.length > 5) {
    expect(screen.queryByRole("heading", { name: releases[5]!.title })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /更多版本|More releases/ }));
    expect(screen.getByRole("heading", { name: releases[5]!.title })).toBeTruthy();
  }
  expect(screen.queryByText("Unreleased")).toBeNull();
  view.rerender(<ChangelogPage route="changelog/0.3.1/" />);
  expect(screen.getByRole("heading", { name: "Loop 0.3.1" })).toBeTruthy();
  expect(screen.getByText(new RegExp("@loop-harness/loop"))).toBeTruthy();
});
