import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { HelpSettings } from "./HelpSettings";

test("recent releases open an offline dialog and restore focus to the selected release", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const view = render(<HelpSettings />);
    expect(view.getByRole("link", { name: "Documentation ↗" }).getAttribute("href")).toContain(
      "docs/0.4.0/",
    );
    expect(view.getAllByRole("button")).toHaveLength(2);
    const release = view.getByRole("button", { name: /Loop 0.4.0/ });
    release.focus();
    fireEvent.click(release);
    const dialog = view.getByRole("dialog", { name: "Loop 0.4.0" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.textContent).toContain("Breaking Changes");
    fireEvent(dialog, new window.Event("cancel", { cancelable: true }) as unknown as Event);
    expect(view.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(release);
    expect(view.getByRole("link", { name: "Full changelog ↗" }).getAttribute("target")).toBe(
      "_blank",
    );
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
