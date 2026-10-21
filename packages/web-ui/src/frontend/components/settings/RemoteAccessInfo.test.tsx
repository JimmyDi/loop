import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { i18n } from "../../i18n/setup";
import { RemoteAccessInfo } from "./RemoteAccessInfo";

test.each(["en", "zh"])(
  "%s info tooltip supports hover, links, keyboard and touch inside settings",
  async (language) => {
    const window = new Window({ width: language === "en" ? 1024 : 390 });
    const previous = { window: globalThis.window, document: globalThis.document };
    const previousLanguage = i18n.language;
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup, waitFor, act } = await import(
      "@testing-library/react/pure"
    );
    try {
      await i18n.changeLanguage(language);
      const view = render(
        <dialog open>
          <RemoteAccessInfo />
          <button type="button">Outside</button>
        </dialog>,
      );
      const trigger = view.getByRole("button", { name: i18n.t("remote.info") });
      const measure = vi
        .spyOn(window.HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          return this.getAttribute("role") === "tooltip"
            ? new window.DOMRect(0, 0, 340, 68)
            : new window.DOMRect(200, 120, 30, 30);
        });
      expect(view.queryByRole("tooltip")).toBeNull();
      fireEvent.mouseEnter(trigger);
      const tooltip = view.getByRole("tooltip");
      expect(tooltip.style.left).toBe(language === "en" ? "238px" : "38px");
      expect(tooltip.style.top).toBe(language === "en" ? "101px" : "44px");
      measure.mockRestore();
      expect(tooltip.parentElement?.tagName).toBe("DIALOG");
      expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
      const links = tooltip.querySelectorAll("a");
      expect([...links].map((link) => link.href)).toEqual([
        "https://aka.ms/devtunnels/tos",
        "https://privacy.microsoft.com/privacystatement",
      ]);
      expect(tooltip.textContent).toContain(i18n.t("remote.termsPrefix"));
      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(tooltip);
      fireEvent.scroll(tooltip);
      expect(view.getByRole("tooltip")).toBe(tooltip);
      fireEvent.mouseLeave(tooltip);
      await waitFor(() => expect(view.queryByRole("tooltip")).toBeNull());
      await act(async () => trigger.focus());
      fireEvent.keyDown(trigger, { key: "Tab" });
      expect(document.activeElement).toBe(view.getAllByRole("link")[0]);
      fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(trigger);
      fireEvent.keyDown(trigger, { key: "Tab" });
      fireEvent.pointerDown(document.activeElement!);
      expect(view.getByRole("tooltip")).toBeTruthy();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(view.queryByRole("tooltip")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      fireEvent.click(trigger);
      expect(view.getByRole("tooltip")).toBeTruthy();
      fireEvent.pointerDown(view.getByRole("button", { name: "Outside" }));
      expect(view.queryByRole("tooltip")).toBeNull();
      fireEvent.click(trigger);
      fireEvent.scroll(document.body);
      expect(view.queryByRole("tooltip")).toBeNull();
      fireEvent.click(trigger);
      await act(async () => window.dispatchEvent(new window.Event("resize")));
      expect(view.queryByRole("tooltip")).toBeNull();
    } finally {
      cleanup();
      await i18n.changeLanguage(previousLanguage);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
