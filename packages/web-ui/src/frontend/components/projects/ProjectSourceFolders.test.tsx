import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ProjectSourceFolders } from "./ProjectSourceFolders";

test("empty selection exposes Add; an active picker disables it", () => {
  const html = renderToStaticMarkup(
    <ProjectSourceFolders path="" picking disabled={false} onAdd={() => {}} onRemove={() => {}} />,
  );
  expect(html).toContain('aria-label="Source folders"');
  expect(html).toContain("Add a folder on this computer");
  expect(html).toContain("Choosing…");
  expect(html).toContain('disabled=""');
  expect(html).not.toContain("This computer");
});

test("selection shows the computer and folder instead of the Add prompt", () => {
  const html = renderToStaticMarkup(
    <ProjectSourceFolders
      path="/example/folder"
      picking={false}
      disabled={false}
      onAdd={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(html).toContain("This computer");
  expect(html).toContain("Remove folder folder");
  expect(html).not.toContain("Add a folder on this computer");
});
