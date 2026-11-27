import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";
import { ScheduleSelect } from "./ScheduleSelect";

test("opens a local list, updates the submitted value and dismisses with Escape", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document: window.document, Event: window.Event });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const changed = vi.fn();
  try {
    const ui = render(
      <form onChange={changed}>
        <label>
          Repeat
          <ScheduleSelect name="repeat" defaultValue="daily">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </ScheduleSelect>
        </label>
      </form>,
    );
    const trigger = ui.getByRole("button");
    fireEvent.click(trigger);
    expect(ui.getByRole("listbox").parentElement).toBe(trigger.parentElement);
    fireEvent.click(ui.getByRole("option", { name: "Weekly" }));
    expect(trigger.textContent).toBe("Weekly");
    expect(ui.container.querySelector("select")?.value).toBe("weekly");
    expect(changed).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(ui.getByRole("listbox"), { key: "Escape" });
    expect(ui.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
