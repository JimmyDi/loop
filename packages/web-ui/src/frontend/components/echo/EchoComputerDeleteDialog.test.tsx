import { Window } from "happy-dom";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { EchoComputerDeleteDialog } from "./EchoComputerDeleteDialog";

test("delete confirmation explains retained files", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <EchoComputerDeleteDialog
        computerId={"a".repeat(32)}
        pending={false}
        error={undefined}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(view.getByRole("dialog", { name: "Delete computer" }).textContent).toContain(
      "File volumes are retained",
    );
    expect(view.getByRole("dialog").textContent).toContain("aaaaaaaa");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
