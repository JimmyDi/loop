import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { CreateProjectActions } from "./CreateProjectActions";

test.each([
  [false, false, "Create project", 1],
  [false, true, "Create project", 0],
  [true, false, "Saving…", 2],
])("creation actions reflect readiness and saving: %s %s", (saving, canCreate, label, disabled) => {
  const html = renderToStaticMarkup(
    <CreateProjectActions saving={saving} canCreate={canCreate} onCancel={() => {}} />,
  );
  expect(html).toContain('type="submit"');
  expect(html).toContain('type="button"');
  expect(html).toContain(label);
  expect(html.match(/disabled=""/g) ?? []).toHaveLength(disabled);
});
