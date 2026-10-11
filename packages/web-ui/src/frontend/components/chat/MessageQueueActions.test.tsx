import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { MessageQueueActions } from "./MessageQueueActions";

const props = {
  disabled: false,
  editing: false,
  steering: false,
  onEdit: () => {},
  onSteer: () => {},
  onDelete: () => {},
};

test("rows expose steer, icon deletion and more options while edit stays in the menu", () => {
  const html = renderToStaticMarkup(<MessageQueueActions {...props} />);
  expect(html).toContain("Steer");
  expect(html).toContain('aria-label="Delete"');
  expect(html).toContain('aria-label="More message options"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain("Edit");
});

test("menu supports keyboard dismissal, outside clicks, blocked state and row actions", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const actions: string[] = [];
  const callbacks = {
    onEdit: () => actions.push("edit"),
    onSteer: () => actions.push("steer"),
    onDelete: () => actions.push("delete"),
  };
  try {
    const ui = render(<MessageQueueActions {...props} {...callbacks} />);
    const trigger = ui.getByRole("button", { name: "More message options" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const edit = ui.getByRole("menuitem", { name: "Edit" });
    expect(document.activeElement).toBe(edit);
    expect(ui.getByRole("menu").parentElement).toBe(document.body);
    expect(trigger.getAttribute("aria-controls")).toBe(ui.getByRole("menu").id);
    fireEvent.keyDown(edit, { key: "Escape" });
    expect(ui.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(ui.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(ui.getByRole("menuitem", { name: "Edit" }));
    expect(actions).toEqual(["edit"]);
    expect(ui.queryByRole("menu")).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Steer" }));
    fireEvent.click(ui.getByRole("button", { name: "Delete" }));
    expect(actions).toEqual(["edit", "steer", "delete"]);
    fireEvent.click(trigger);
    ui.rerender(<MessageQueueActions {...props} {...callbacks} disabled />);
    expect(ui.queryByRole("menu")).toBeNull();
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    ui.rerender(<MessageQueueActions {...props} {...callbacks} editing />);
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    expect((ui.getByRole("button", { name: "Steer" }) as HTMLButtonElement).disabled).toBe(true);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
