import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Interfaces } from "./Interfaces";

afterEach(cleanup);

it("keeps the anchored section and all three entry choices", () => {
  const { container } = render(<Interfaces />);
  expect(container.querySelector("#interfaces")?.getAttribute("aria-labelledby")).toBe(
    "interfaces-title",
  );
  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("在你习惯的地方");
});
