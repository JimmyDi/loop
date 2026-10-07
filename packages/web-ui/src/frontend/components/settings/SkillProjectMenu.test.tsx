import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { SkillProjectMenu } from "./SkillProjectMenu";

test("project dropdown supports selection, keyboard dismissal and outside interaction", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const choose = vi.fn();
    const projects = [
      { id: "one", name: "Example" },
      { id: "two", name: "Another project" },
    ];
    const props = { projects, selected: "two", disabled: false, onSelect: choose };
    const view = render(<SkillProjectMenu {...props} />);
    const trigger = view.getByRole("button", { name: "More projects" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(trigger);
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.getByRole("menu", { name: "More projects" }).parentElement).toBe(
      trigger.parentElement,
    );
    const first = view.getByRole("menuitemradio", { name: "Example" });
    const second = view.getByRole("menuitemradio", { name: "Another project" });
    expect(second.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Home" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(document.activeElement).toBe(
      view.getByRole("menuitemradio", { name: "Another project" }),
    );
    fireEvent.click(view.getByRole("menuitemradio", { name: "Example" }));
    expect(choose).toHaveBeenCalledWith("one");
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.keyDown(view.getByRole("menuitemradio", { name: "Example" }), { key: "Tab" });
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    view.rerender(<SkillProjectMenu {...props} disabled />);
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    expect(view.queryByRole("menu")).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
