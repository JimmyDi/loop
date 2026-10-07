import { useState } from "react";
import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { SkillScopeTabs } from "./SkillScopeTabs";

test("scope tabs support keyboard navigation and lock during installation", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const change = vi.fn();
    const projects = [
      { id: "one", name: "Example" },
      { id: "two", name: "Other" },
    ];
    const Tabs = ({ disabled = false }: { disabled?: boolean }) => {
      const [value, setValue] = useState("");
      return (
        <SkillScopeTabs
          value={value}
          projects={projects}
          disabled={disabled}
          onChange={(next) => {
            change(next);
            setValue(next);
          }}
        />
      );
    };
    const view = render(<Tabs />);
    const personal = view.getByRole("tab", { name: "Personal" });
    personal.focus();
    fireEvent.keyDown(personal, { key: "ArrowRight" });
    const project = view.getByRole("tab", { name: "Example" });
    expect(project.getAttribute("aria-selected")).toBe("true");
    expect(window.document.activeElement).toBe(project);
    fireEvent.keyDown(project, { key: "End" });
    expect(change).toHaveBeenLastCalledWith("two");
    fireEvent.keyDown(view.getByRole("tab", { name: "Other" }), { key: "ArrowRight" });
    expect(change).toHaveBeenLastCalledWith("");
    fireEvent.keyDown(personal, { key: "ArrowLeft" });
    expect(change).toHaveBeenLastCalledWith("two");
    fireEvent.keyDown(view.getByRole("tab", { name: "Other" }), { key: "Home" });
    expect(change).toHaveBeenLastCalledWith("");
    view.rerender(<Tabs disabled />);
    change.mockClear();
    fireEvent.click(project);
    fireEvent.keyDown(personal, { key: "ArrowRight" });
    expect(change).not.toHaveBeenCalled();
    expect(view.getAllByRole("tab").every((tab) => tab.hasAttribute("disabled"))).toBe(true);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("scope tabs adapt to available width and show only overflow projects in a dropdown", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    ResizeObserver: globalThis.ResizeObserver,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const bounds = window.HTMLElement.prototype.getBoundingClientRect;
  let width = 380;
  const resize = new Set<() => void>();
  class Observer {
    constructor(private callback: () => void) {
      resize.add(callback);
    }
    observe() {}
    disconnect() {
      resize.delete(this.callback);
    }
  }
  globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const size = this.classList.contains("skill-scope-control")
      ? width
      : this.classList.contains("skill-scope-more")
        ? 36
        : this.textContent === "Personal"
          ? 80
          : 60;
    return new window.DOMRect(0, 0, size, 36);
  };
  try {
    await i18n.changeLanguage("en");
    const change = vi.fn();
    const Tabs = () => {
      const [value, setValue] = useState("");
      return (
        <SkillScopeTabs
          value={value}
          projects={[
            { id: "one", name: "Example" },
            { id: "two", name: "Other" },
            { id: "three", name: "Hidden" },
          ]}
          disabled={false}
          onChange={(next) => {
            setValue(next);
            change(next);
          }}
        />
      );
    };
    const view = render(<Tabs />);
    expect(view.queryByRole("button", { name: "More projects" })).toBeNull();
    await act(async () => {
      width = 200;
      for (const callback of resize) callback();
    });
    expect(view.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Personal", "Example"]);
    const more = view.getByRole("button", { name: "More projects" });
    more.focus();
    fireEvent.click(more);
    const menu = view.getByRole("menu", { name: "More projects" });
    expect(view.queryByRole("dialog")).toBeNull();
    expect(menu.textContent).toContain("Other");
    expect(menu.textContent).toContain("Hidden");
    expect(menu.textContent).not.toContain("Example");
    fireEvent.click(view.getByRole("menuitemradio", { name: "Hidden" }));
    expect(change).toHaveBeenLastCalledWith("three");
    expect(view.queryByRole("menu")).toBeNull();
    expect(view.getByRole("tab", { name: "Hidden" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(more);
    await act(async () => {
      width = 380;
      for (const callback of resize) callback();
    });
    expect(view.getAllByRole("tab")).toHaveLength(4);
    expect(view.queryByRole("button", { name: "More projects" })).toBeNull();
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = bounds;
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
