import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { GeneralSettings } from "./GeneralSettings";

test("General exposes language and appearance settings", () => {
  const html = renderToStaticMarkup(<GeneralSettings />);

  expect(html).toContain("Language");
  expect(html).toContain('aria-haspopup="listbox"');
  expect(html).not.toContain("Permission");
  expect(html).toContain("Appearance");
  expect(html).toContain("System");
});
