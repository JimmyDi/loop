import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { ExternalLink } from "./ExternalLink";

afterEach(cleanup);

it("keeps documentation in a separate tab with a safe opener policy", () => {
  render(<ExternalLink href="https://example.com/docs">Docs</ExternalLink>);
  const link = screen.getByRole("link", { name: "Docs" });
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});
