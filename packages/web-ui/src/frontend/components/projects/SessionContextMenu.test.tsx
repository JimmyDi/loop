import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { SessionContextMenu } from "./SessionContextMenu";
import type { useProjectMenu } from "../../hooks/useProjectMenu";

test("session menu places Mark as unread below Pin and supports Unpin while busy", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const chosen: string[] = [];
  const menu = {
    panel: { current: null },
    position: { top: 10, left: 20 },
    navigate: () => {},
    close: () => {},
  } as unknown as ReturnType<typeof useProjectMenu>;
  try {
    const ui = render(
      <SessionContextMenu
        menu={menu}
        title="Example"
        disabled={false}
        onChoose={(action) => chosen.push(action)}
      />,
    );
    expect(ui.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Rename",
      "Pin",
      "Mark as unread",
      "Reveal",
      "Archive",
      "Permanently delete",
    ]);
    fireEvent.click(ui.getByRole("menuitem", { name: "Mark as unread" }));
    expect(chosen.pop()).toBe("unread");
    ui.rerender(
      <SessionContextMenu
        menu={menu}
        title="Example"
        disabled={false}
        unread
        onChoose={(action) => chosen.push(action)}
      />,
    );
    expect(
      (ui.getByRole("menuitem", { name: "Mark as unread" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(ui.getByRole("menuitem", { name: "Reveal" }));
    expect(chosen.pop()).toBe("reveal");
    fireEvent.click(ui.getByRole("menuitem", { name: "Archive" }));
    expect(chosen).toEqual(["archive"]);
    ui.rerender(
      <SessionContextMenu
        menu={menu}
        title="Example"
        disabled={true}
        pinned={true}
        onChoose={(action) => chosen.push(action)}
      />,
    );
    fireEvent.click(ui.getByRole("menuitem", { name: "Permanently delete" }));
    expect(chosen).toEqual(["archive"]);
    fireEvent.click(ui.getByRole("menuitem", { name: "Unpin" }));
    fireEvent.click(ui.getByRole("menuitem", { name: "Mark as unread" }));
    expect(chosen).toEqual(["archive", "pin", "unread"]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("remote session menu also exposes Mark as unread", async () => {
  const window = new Window();
  window.document.head.innerHTML = '<meta name="loop-remote" content="1">';
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const menu = {
    panel: { current: null },
    position: {},
    navigate: () => {},
    close: () => {},
  } as unknown as ReturnType<typeof useProjectMenu>;
  try {
    const ui = render(
      <SessionContextMenu menu={menu} title="Example" disabled={false} onChoose={() => {}} />,
    );
    expect(ui.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Rename",
      "Pin",
      "Mark as unread",
    ]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
