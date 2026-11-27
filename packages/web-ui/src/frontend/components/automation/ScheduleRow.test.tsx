import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";
import type { Schedule } from "../../../shared/schedules";
import "../../i18n/setup";
import { ScheduleRow } from "./ScheduleRow";

test("runs a task and switches its menu from pause to resume", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const plan: Schedule = {
    id: "demo",
    name: "Review",
    projectId: "demo",
    prompt: "Review",
    revision: 1,
    permission: "read-only",
    missed: "skip",
    status: "active",
    next: Date.UTC(2026, 0, 2, 9),
    trigger: { kind: "cron", expression: "0 9 * * *", timezone: "UTC" },
  };
  const props = {
    plan,
    project: "Demo project",
    now: Date.UTC(2026, 0, 1, 10),
    busy: false,
    edit: vi.fn(),
    change: vi.fn(),
  };
  try {
    const view = render(<ScheduleRow {...props} />);
    expect(view.getByRole("img", { name: "Active" })).toBeTruthy();
    expect(view.getByText("Daily 09:00")).toBeTruthy();
    expect(view.getByText("Demo project")).toBeTruthy();
    expect(view.getByText("Runs in 23 hours").tagName).toBe("TIME");
    fireEvent.click(view.getByRole("button", { name: "Test run" }));
    const more = view.getByRole("button", { name: "More actions for Review" });
    fireEvent.click(more);
    fireEvent.click(view.getByRole("menuitem", { name: "Pause" }));
    view.rerender(<ScheduleRow {...props} plan={{ ...plan, status: "paused" }} />);
    expect(view.getByRole("img", { name: "Paused" })).toBeTruthy();
    fireEvent.click(more);
    fireEvent.click(view.getByRole("menuitem", { name: "Resume" }));
    fireEvent.click(more);
    fireEvent.click(view.getByRole("menuitem", { name: "Delete" }));
    for (const status of ["queued", "running"] as const) {
      const activeRun = {
        id: "demo-run",
        input: plan,
        revision: 1,
        scheduleId: plan.id,
        source: "timer" as const,
        scheduledFor: 1,
        status,
      };
      view.rerender(<ScheduleRow {...props} plan={{ ...plan, status: "completed", activeRun }} />);
      expect(
        view.getByRole("img", { name: status === "queued" ? "Queued" : "Running" }),
      ).toBeTruthy();
    }
    expect(props.change.mock.calls).toEqual([["run"], ["pause"], ["resume"], ["delete"]]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
