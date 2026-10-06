import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ProjectSourceFolder } from "./ProjectSourceFolder";

test.each([
  ["/example/source-folder/", "source-folder"],
  ["C:\\example\\source-folder\\", "source-folder"],
  ["/example/项目 文件夹", "项目 文件夹"],
  ["/", "/"],
])("folder row displays the final path segment and retains the full path: %s", (path, name) => {
  const html = renderToStaticMarkup(
    <ProjectSourceFolder path={path} disabled={false} onRemove={() => {}} />,
  );
  expect(html).toContain('title="' + path + '"');
  expect(html).toContain('aria-label="Remove folder ' + name + '"');
  expect(html).toContain(">" + name + "</span>");
});

test("saving disables removal of the selected folder", () => {
  const html = renderToStaticMarkup(
    <ProjectSourceFolder path="/example/folder" disabled onRemove={() => {}} />,
  );
  expect(html).toContain('disabled=""');
});
