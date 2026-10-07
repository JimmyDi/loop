import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { PluginAddMenu } from "./PluginAddMenu";

test.each([
  { section: "mcps" as const, labels: ["Add MCP server"], actions: ["mcp"] },
  {
    section: "skills" as const,
    labels: ["Create skill", "Install from GitHub", "Add local folder"],
    actions: ["created", "github", "local"],
  },
])(
  "$section Add supports pointer selection, dismissal and keyboard navigation",
  async ({ section, labels, actions }) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    const language = i18n.language;
    const onAdd = vi.fn();
    try {
      await i18n.changeLanguage("en");
      const view = render(<PluginAddMenu section={section} onSelect={onAdd} />);
      const trigger = view.getByRole("button", { name: "Add" });
      fireEvent.click(trigger);
      const option = view.getByRole("menuitem", { name: labels[0] });
      fireEvent.pointerDown(option);
      fireEvent.blur(option, { relatedTarget: null });
      expect(view.getByRole("menuitem", { name: labels[0] })).toBe(option);
      expect(view.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(labels);
      expect(
        view.getAllByRole("menuitem").every((item) => item.querySelector("svg[aria-hidden=true]")),
      ).toBe(true);
      fireEvent.click(option);
      expect(onAdd).toHaveBeenCalledOnce();
      expect(onAdd).toHaveBeenLastCalledWith(actions[0]);
      expect(view.queryByRole("menu")).toBeNull();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      expect(document.activeElement).toBe(view.getByRole("menuitem", { name: labels[0] }));
      for (const name of [...labels.slice(1), labels[0]]) {
        fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
        expect(document.activeElement).toBe(view.getByRole("menuitem", { name }));
      }
      fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
      expect(document.activeElement).toBe(view.getByRole("menuitem", { name: labels.at(-1) }));
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(document.activeElement).toBe(trigger);
      expect(view.queryByRole("menu")).toBeNull();
      fireEvent.click(trigger);
      fireEvent.pointerDown(document.body);
      expect(view.queryByRole("menu")).toBeNull();
      fireEvent.click(trigger);
      const refocusedOption = view.getByRole("menuitem", { name: labels[0] });
      fireEvent.pointerDown(refocusedOption);
      fireEvent.blur(refocusedOption, { relatedTarget: document.body });
      expect(view.getByRole("menuitem", { name: labels[0] })).toBe(refocusedOption);
      fireEvent.click(refocusedOption);
      expect(onAdd).toHaveBeenCalledTimes(2);
      expect(onAdd).toHaveBeenLastCalledWith(actions[0]);
      fireEvent.click(trigger);
      fireEvent.keyDown(view.getByRole("menuitem", { name: labels[0] }), { key: "Tab" });
      expect(view.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      fireEvent.keyDown(trigger, { key: "ArrowUp" });
      expect(document.activeElement).toBe(view.getByRole("menuitem", { name: labels.at(-1) }));
      // Native button keyboard activation dispatches click; browser QA checks Enter itself.
      fireEvent.click(document.activeElement!, { detail: 0 });
      expect(onAdd).toHaveBeenCalledTimes(3);
      expect(onAdd).toHaveBeenLastCalledWith(actions.at(-1));
      view.rerender(<PluginAddMenu section={section} onSelect={onAdd} disabled />);
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      expect(view.queryByRole("menu")).toBeNull();
    } finally {
      cleanup();
      await i18n.changeLanguage(language);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
