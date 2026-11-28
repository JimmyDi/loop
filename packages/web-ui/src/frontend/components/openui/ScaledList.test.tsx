// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import "../../i18n/setup";
import ScaledList from "./ScaledList";

afterEach(cleanup);

test("rescales ingredient quantities without submitting a message", () => {
  const ui = render(
    <ScaledList
      title="Shopping list"
      baseServings={4}
      items={[{ name: "Rice", amount: 300, unit: "g" }]}
    />,
  );
  const slider = ui.getByRole("slider");
  for (let step = 0; step < 2; step += 1) fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(ui.getByText("450 g")).toBeTruthy();
});
