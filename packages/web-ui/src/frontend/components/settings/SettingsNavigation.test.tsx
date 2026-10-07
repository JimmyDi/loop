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
    const mcps = ui.getByRole("tab", { name: "MCPs" });
    const skills = ui.getByRole("tab", { name: "Skills" });
    expect(ui.getByRole("tablist", { name: "Integrations" })).toBeTruthy();
    expect(ui.queryByRole("tab", { name: "Plugins" })).toBeNull();
    expect(mcps.tabIndex).toBe(0);
    expect(skills.tabIndex).toBe(-1);
    fireEvent.keyDown(mcps, { key: "ArrowDown" });
    expect(document.activeElement).toBe(skills);
    expect(selected.pop()).toBe("skills");
    fireEvent.keyDown(skills, { key: "ArrowDown" });
    expect(document.activeElement).toBe(mcps);
    expect(selected.pop()).toBe("mcps");
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
