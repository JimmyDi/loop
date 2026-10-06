import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ComposerProjectSearch } from "./ComposerProjectSearch";

test("project search has an accessible label and is disabled during project changes", () => {
  const html = renderToStaticMarkup(
    <ComposerProjectSearch value="Example" disabled onChange={() => {}} />,
  );
  expect(html).toContain('type="search"');
  expect(html).toContain('aria-label="Search projects"');
  expect(html).toContain('disabled=""');
});
