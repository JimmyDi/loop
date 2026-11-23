import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { EchoGroupDialog } from "./EchoGroupDialog";

test("group dialog selects Agents and derives a name when none is entered", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor, act } = await import("@testing-library/react/pure");
  const create = vi.fn().mockResolvedValue(undefined);
  try {
    const view = render(
      <EchoGroupDialog
        agents={[
          { id: "one", name: "One", instructions: "" },
          { id: "two", name: "Two", instructions: "" },
        ]}
        onClose={() => {}}
        onCreate={create}
      />,
    );
    const dialog = view.getByRole("dialog", { name: "New group chat" });
    const submit = view.getByRole("button", { name: "Create group chat" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(view.getByRole("checkbox", { name: "One" }));
    fireEvent.click(view.getByRole("checkbox", { name: "Two" }));
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(create).toHaveBeenCalledWith("One · Two", ["one", "two"]));
    await act(async () => {
      await Promise.resolve();
    });
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
