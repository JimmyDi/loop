import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { ProviderFeature } from "./ProviderFeature";

afterEach(cleanup);

it("describes mainstream providers without a configuration step list", () => {
  render(<ProviderFeature />);
  expect(screen.getByRole("heading").textContent).toContain("35 个 provider");
  expect(screen.getByText(/自由选择适合的模型，也能接入自己的网关/)).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});
