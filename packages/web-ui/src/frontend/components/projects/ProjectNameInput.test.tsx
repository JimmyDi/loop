import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ProjectNameInput } from "./ProjectNameInput";

test("optional project name has an accessible label and preserves the draft during saving", () => {
  const html = renderToStaticMarkup(
    <ProjectNameInput value="Custom project" disabled onChange={() => {}} />,
  );
  expect(html).toContain('aria-label="Project name"');
  expect(html).toContain('value="Custom project"');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain('required=""');
});
