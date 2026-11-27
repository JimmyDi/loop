import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import "../../i18n/setup";
import { ScheduleForm } from "./ScheduleForm";

test("offers only accessible projects and defaults to read only", () => {
  const html = renderToStaticMarkup(
    <ScheduleForm
      projects={[
        { id: "a", name: "Demo", cwd: "demo", accessible: true },
        { id: "b", name: "Unavailable", cwd: "missing", accessible: false },
      ]}
      busy={false}
      save={() => {}}
      cancel={() => {}}
    />,
  );
  expect(html).toContain("<h2>Basics</h2>");
  expect(html).toContain("<h2>Advanced</h2>");
  expect(html).toContain("Demo");
  expect(html).not.toContain("Unavailable");
  expect(html).toContain('value="read-only" selected');
  expect(html).toContain('<option value="danger-full-access">Full access</option>');
  expect(html).toContain('value="09:00"');
});
