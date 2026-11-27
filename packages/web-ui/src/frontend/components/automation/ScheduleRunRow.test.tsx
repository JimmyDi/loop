import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import "../../i18n/setup";
import { ScheduleRunRow } from "./ScheduleRunRow";

test("shows archive and delete only for finished runs", () => {
  const render = (status: "running" | "completed" | "failed") =>
    renderToStaticMarkup(
      <ScheduleRunRow
        run={{
          id: "run",
          scheduleId: "task",
          revision: 1,
          source: "manual",
          status,
          scheduledFor: 100,
          input: { name: "Example", projectId: "project" },
        }}
        busy={false}
        dayFormat={new Intl.DateTimeFormat("en")}
        clock={new Intl.DateTimeFormat("en")}
        archive={() => {}}
        remove={() => {}}
      />,
    );
  expect(render("running")).toContain('data-status="running" role="img" aria-label="Running"');
  expect(render("completed")).toContain(
    'data-status="completed" role="img" aria-label="Completed"',
  );
  expect(render("failed")).toContain('data-status="failed" role="img" aria-label="Failed"');
  expect(render("running")).not.toContain("Archive run");
  expect(render("completed")).toContain("Archive run");
  expect(render("completed")).toContain("Delete permanently");
});
