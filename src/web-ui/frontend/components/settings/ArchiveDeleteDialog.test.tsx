import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ArchiveDeleteDialog } from "./ArchiveDeleteDialog";

test("archive deletion warns of permanence and blocks closing and repeat submission while pending", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let called = 0;
  try {
    const ui = render(
      <ArchiveDeleteDialog
        count={2}
        pending
        error={null}
        onClose={() => called++}
        onConfirm={() => called++}
      />,
    );
    expect(ui.getByText(/cannot be undone/)).toBeTruthy();
    const dialog = ui.getByRole("dialog", { name: "Delete 2 archived chats?" });
    fireEvent(dialog, new window.Event("cancel", { cancelable: true }) as unknown as Event);
    for (const button of ui.getAllByRole("button")) fireEvent.click(button);
    expect(called).toBe(0);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
