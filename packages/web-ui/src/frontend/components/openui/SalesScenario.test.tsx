// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import "../../i18n/setup";
import SalesScenario from "./SalesScenario";

afterEach(cleanup);

test("recalculates the projection and keeps actual revenue", () => {
  const ui = render(
    <SalesScenario title="Sales" currency="USD" rows={[{ period: "Jan", revenue: 200 }]} />,
  );
  const slider = ui.getByRole("slider");
  for (let step = 0; step < 15; step += 1) fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(ui.getByText("Projected total: $230.00")).toBeTruthy();
  expect(ui.getByText("$200.00")).toBeTruthy();
});
