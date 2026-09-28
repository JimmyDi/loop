import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { SessionDeleteDialog } from "./SessionDeleteDialog";

test("permanent deletion warns about irreversibility and blocks close and duplicates while pending", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let confirmed = 0;
  let closed = 0;
  try {
    const props = {
      pending: false,
      error: undefined,
      onClose: () => closed++,
      onConfirm: () => confirmed++,
    };
    const ui = render(<SessionDeleteDialog {...props} />);
    expect(ui.getByRole("dialog", { name: "Delete chat?" }).textContent).toContain(
      "This cannot be undone.",
    );
    expect(ui.getByRole("dialog").textContent).not.toContain("subagent");
    expect(confirmed).toBe(0);
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(closed).toBe(1);
    fireEvent.click(ui.getByRole("button", { name: "Delete" }));
    expect(confirmed).toBe(1);
    ui.rerender(<SessionDeleteDialog {...props} pending />);
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    fireEvent.click(ui.getByRole("button", { name: "Close" }));
    fireEvent(
      ui.getByRole("dialog"),
      new window.Event("cancel", { bubbles: true, cancelable: true }) as unknown as Event,
    );
    expect(closed).toBe(1);
    expect(
      ui.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
