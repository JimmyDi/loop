import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { PlanIcon } from "./PlanIcon";

test("plan icon is decorative and sized by its colocated style", () => {
  expect(renderToStaticMarkup(<PlanIcon />)).toContain('aria-hidden="true"');
});
