import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { McpAddMenu } from "./McpAddMenu";

test("Add survives transient focus changes and supports outside dismissal and keyboard activation", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const onAdd = vi.fn();
  try {
    await i18n.changeLanguage("en");
    const view = render(<McpAddMenu onAdd={onAdd} />);
    const trigger = view.getByRole("button", { name: "Add" });
    fireEvent.click(trigger);
    const option = view.getByRole("menuitem", { name: "Add MCP server" });
    fireEvent.pointerDown(option);
    fireEvent.blur(option, { relatedTarget: null });
    expect(view.getByRole("menuitem")).toBe(option);
    fireEvent.click(option);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(document.activeElement).toBe(view.getByRole("menuitem"));
    fireEvent.keyDown(view.getByRole("menuitem"), { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    const refocusedOption = view.getByRole("menuitem");
    fireEvent.pointerDown(refocusedOption);
    fireEvent.blur(refocusedOption, { relatedTarget: document.body });
    expect(view.getByRole("menuitem")).toBe(refocusedOption);
    fireEvent.click(refocusedOption);
    expect(onAdd).toHaveBeenCalledTimes(2);
    fireEvent.click(trigger);
    fireEvent.keyDown(view.getByRole("menuitem"), { key: "Tab" });
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    // Native button keyboard activation dispatches click; browser QA checks Enter itself.
    fireEvent.click(view.getByRole("menuitem"), { detail: 0 });
    expect(onAdd).toHaveBeenCalledTimes(3);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
