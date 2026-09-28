import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ProjectConfirmation } from "./ProjectConfirmation";

test("pending confirmations cannot submit twice or close via Escape", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let closed = 0;
  let submitted = 0;
  try {
    const ui = render(
      <ProjectConfirmation
        action="archive"
        name="Example"
        count={2}
        pending
        loading={false}
        error={null}
        drafts={false}
        onClose={() => closed++}
        onConfirm={() => submitted++}
      />,
    );
    const dialog = ui.getByRole("dialog");
    fireEvent(dialog, new window.Event("cancel", { cancelable: true }) as unknown as Event);
    for (const button of ui.getAllByRole("button")) fireEvent.click(button);
    expect(closed).toBe(0);
    expect(submitted).toBe(0);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
