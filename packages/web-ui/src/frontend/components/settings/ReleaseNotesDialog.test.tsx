import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ReleaseNotesDialog } from "./ReleaseNotesDialog";

test("release dialog displays its own version and closes through its control", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let closed = false;
  try {
    const view = render(
      <ReleaseNotesDialog
        release={{
          version: "1.0.0",
          date: "2026-01-01",
          title: "Loop 1.0.0",
          notes: "### Fixed\n\n- Synthetic fix.",
        }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    expect(view.getByRole("dialog").textContent).toContain("Synthetic fix.");
    expect(view.getByRole("link").getAttribute("href")).toContain("changelog/1.0.0/");
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(closed).toBe(true);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
