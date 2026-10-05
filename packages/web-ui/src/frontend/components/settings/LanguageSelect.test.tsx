import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { LanguageSelect } from "./LanguageSelect";

test("language menu supports selection, keyboard navigation, dismissal and focus return", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const language = i18n.language;

  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");

  try {
    await i18n.changeLanguage("en");
    const view = render(
      <div>
        <span id="language-label">Language</span>
        <LanguageSelect labelId="language-label" />
        <button type="button">Outside</button>
      </div>,
    );
    const trigger = view.getByRole("button", { name: "Language English" });

    fireEvent.click(trigger);
    const english = view.getByRole("option", { name: "English" });
    const chinese = view.getByRole("option", { name: "中文" });

    expect(english.getAttribute("aria-selected")).toBe("true");
    expect(english.querySelector("svg")).not.toBeNull();
    expect(document.activeElement).toBe(english);
    fireEvent.keyDown(english, { key: "ArrowUp" });
    expect(document.activeElement).toBe(chinese);
    fireEvent.keyDown(chinese, { key: "End" });
    expect(document.activeElement).toBe(english);
    fireEvent.keyDown(english, { key: "Home" });
    expect(document.activeElement).toBe(chinese);
    await act(async () => fireEvent.click(chinese));
    expect(i18n.language).toBe("zh");
    expect(window.document.documentElement.lang).toBe("zh");
    expect(view.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const selected = view.getByRole("option", { name: "中文" });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(selected);
    const escape = new window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(selected, escape as unknown as Event);
    expect(escape.defaultPrevented).toBe(true);
    expect(view.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.pointerDown(view.getByRole("button", { name: "Outside" }));
    expect(view.queryByRole("listbox")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(view.getByRole("option", { name: "中文" }), { key: "Tab" });
    expect(view.queryByRole("listbox")).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
