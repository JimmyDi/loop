import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { SectionHeading } from "./SectionHeading";

afterEach(cleanup);

it("associates a stable anchor with adaptable text and description", () => {
  render(
    <SectionHeading id="section" first="First" last="Second" description={["One.", "Two."]} />,
  );
  expect(screen.getByRole("heading", { level: 2 }).id).toBe("section");
  expect(screen.getByText("One. Two.").textContent).toBe("One.\nTwo.");
});
