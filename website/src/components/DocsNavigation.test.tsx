import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { DocsNavigation } from "./DocsNavigation";

afterEach(cleanup);

test("search filters the selected release and reports empty results", () => {
  render(<DocsNavigation version="0.4.0" slug="getting-started" />);
  expect(screen.queryByRole("combobox")).toBeNull();
  const search = screen.getByRole("searchbox");
  fireEvent.change(search, { target: { value: "nonexistent-synthetic-topic" } });
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getAllByRole("link").length).toBeGreaterThan(10);
});
