import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsIcon } from "./SettingsIcon";

test("Settings icon follows the surrounding theme and stays decorative", () => {
  const html = renderToStaticMarkup(<SettingsIcon />);

  expect(html).toContain('stroke="currentColor"');
  expect(html).toContain('aria-hidden="true"');
});
