import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectSourceIcon } from "./ProjectSourceIcon";

test("source icons remain decorative so their controls provide accessible names", () => {
  const html = renderToStaticMarkup(<ProjectSourceIcon kind="folder" />);
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("<title>");
});
