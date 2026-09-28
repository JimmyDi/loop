import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { SessionContextMenu } from "./SessionContextMenu";
import type { useProjectMenu } from "../../hooks/useProjectMenu";

test("session menu exposes only the three requested actions", async () => {
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
      "Archive",
      "Permanently delete",
    ]);
    fireEvent.click(ui.getByRole("menuitem", { name: "Archive" }));
    expect(chosen).toEqual(["archive"]);
    ui.rerender(
      <SessionContextMenu
        menu={menu}
        title="Example"
        disabled={true}
        onChoose={(action) => chosen.push(action)}
      />,
    );
    fireEvent.click(ui.getByRole("menuitem", { name: "Permanently delete" }));
    expect(chosen).toEqual(["archive"]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
