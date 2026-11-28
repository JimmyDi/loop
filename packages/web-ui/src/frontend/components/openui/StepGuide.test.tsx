// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import "../../i18n/setup";
import StepGuide from "./StepGuide";

afterEach(cleanup);

test("moves through steps and resets when changing variants", () => {
  const ui = render(
    <StepGuide
      title="Guide"
      variants={[
        {
          name: "Small",
          steps: [
            { title: "First", description: "One" },
            { title: "Second", description: "Two" },
          ],
        },
        {
          name: "Large",
          steps: [{ title: "Alternate", description: "Three", diagram: ["M0 0 L40 40"] }],
        },
      ]}
    />,
  );
  fireEvent.click(ui.getByRole("button", { name: "Next" }));
  expect(ui.getByRole("heading", { name: "Second" })).toBeTruthy();
  fireEvent.click(ui.getByRole("button", { name: "Large" }));
  expect(ui.getByRole("img", { name: "Alternate" }).querySelector("path")?.getAttribute("d")).toBe(
    "M0 0 L40 40",
  );
  expect((ui.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
});
