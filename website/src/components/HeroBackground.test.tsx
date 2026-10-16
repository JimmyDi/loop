import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { HeroBackground } from "./HeroBackground";

afterEach(cleanup);

it("keeps animated decoration outside the accessibility tree", () => {
  const { container } = render(<HeroBackground />);
  expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryByRole("button")).toBeNull();
});
