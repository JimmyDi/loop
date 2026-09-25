import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsField } from "./SettingsField";

test("settings field connects accessible hints and masks credentials", () => {
  const html = renderToStaticMarkup(
    <SettingsField label="API key" type="password" hint="Local storage" />,
  );

  expect(html).toContain('type="password"');
  expect(html).toContain("aria-describedby");
  expect(html).toContain("Local storage");
});
