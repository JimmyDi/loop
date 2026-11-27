import { setImmediate } from "node:timers/promises";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";
import "../../i18n/setup";
import { ScheduleRunDelete } from "./ScheduleRunDelete";

test("requires explicit confirmation to delete a run", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const confirm = vi.fn();
  const close = vi.fn();
  try {
    const ui = render(
      <ScheduleRunDelete pending={false} error={undefined} close={close} confirm={confirm} />,
    );
    expect(ui.getByRole("dialog", { name: "Permanently delete this run?" })).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "Delete permanently" }));
    expect(confirm).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    await setImmediate();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
