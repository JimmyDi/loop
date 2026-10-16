import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { ProviderFeature } from "./ProviderFeature";

afterEach(cleanup);

it("describes mainstream providers without a configuration step list", () => {
  render(<ProviderFeature />);
  expect(screen.getByRole("heading").textContent).toContain("35 个 provider");
  expect(
    screen.getByText(/自由接入主流 provider 或兼容的自定义网关，按需选择模型、调节思考强度/),
  ).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});
