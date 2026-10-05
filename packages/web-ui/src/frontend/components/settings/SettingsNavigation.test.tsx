import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { SettingsNavigation } from "./SettingsNavigation";

test("settings groups expose separate keyboard entry points and archive selection", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const selected: string[] = [];
  try {
    const ui = render(
      <SettingsNavigation
        id="settings"
        section="appearance"
        onSelect={(value) => selected.push(value)}
      />,
    );
    expect(
      ui.getByRole("tablist", { name: "Personal" }).querySelectorAll('[role="tab"]'),
    ).toHaveLength(3);
    const archived = ui.getByRole("tab", { name: "Archived chats" });
    expect(archived.tabIndex).toBe(0);
    fireEvent.click(archived);
    expect(selected).toEqual(["archivedChats"]);
    fireEvent.keyDown(archived, { key: "End" });
    expect(document.activeElement).toBe(archived);
    expect(archived.getAttribute("aria-controls")).toBe("settings-archivedChats-panel");
    ui.rerender(
      <SettingsNavigation
        id="settings"
        section="archivedChats"
        onSelect={(value) => selected.push(value)}
      />,
    );
    const general = ui.getByRole("tab", { name: "General" });
    general.focus();
    fireEvent.keyDown(general, { key: "ArrowDown" });
    expect(document.activeElement).toBe(ui.getByRole("tab", { name: "Models" }));
    expect(selected.at(-1)).toBe("models");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
