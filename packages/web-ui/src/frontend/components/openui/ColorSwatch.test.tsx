// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import ColorSwatch from "./ColorSwatch";

afterEach(cleanup);

test("shows the supplied color and its readable label", () => {
  const ui = render(<ColorSwatch name="Clay" hex="#a06050" description="Accent" />);
  expect(ui.getByText("Clay")).toBeTruthy();
  expect(ui.getByText("#A06050")).toBeTruthy();
  expect(ui.getByText("Accent")).toBeTruthy();
  expect(ui.container.querySelector("figure > div")?.getAttribute("style")).toContain("#a06050");
});
