import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { NavigationBar } from "./NavigationBar";

test("navigation exposes the Settings menu trigger without Home", () => {
  const html = renderToStaticMarkup(<NavigationBar settingsOpen={true} onSettings={() => {}} />);
  expect(html).toContain('aria-haspopup="menu"');
  expect(html).toContain('aria-label="Settings"');
  expect(html).toContain('data-active="true"');
  expect(html).not.toContain('aria-label="Home"');
});
