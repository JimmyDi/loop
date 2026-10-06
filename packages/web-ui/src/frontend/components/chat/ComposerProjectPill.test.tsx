import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ComposerProjectPill } from "./ComposerProjectPill";

test("project capsule only shows the project, with an accessible remove control", () => {
  const html = renderToStaticMarkup(
    <ComposerProjectPill
      project={{ id: "p", name: "Example", cwd: "/example" }}
      disabled={false}
      expanded={false}
      triggerRef={null}
      onChoose={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(html).toContain("Example");
  expect(html).toContain("Remove project Example");
  expect(html).not.toContain("Local");
  expect(html).not.toContain("main");
});

test("cleared capsule exposes project selection", () => {
  const html = renderToStaticMarkup(
    <ComposerProjectPill
      disabled={false}
      expanded={false}
      triggerRef={null}
      onChoose={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(html).toContain("Choose project");
  expect(html).not.toContain("composer-project-remove");
});
