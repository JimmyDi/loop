import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { feedbackIssueUrl } from "../../lib/feedback-issue";
import { SidebarMenu } from "./SidebarMenu";

test.each([
  ["en", "More", "Settings", "Feedback"],
  ["zh", "更多", "设置", "反馈"],
])(
  "sidebar menu supports actions and keyboard dismissal in %s",
  async (language, label, settings, feedback) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    const previousLanguage = i18n.language;
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    const onOpenSettings = vi.fn();

    try {
      await i18n.changeLanguage(language);
      const view = render(<SidebarMenu onOpenSettings={onOpenSettings} />);
      const trigger = view.getByRole("button", { name: label });
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(view.queryByRole("menu")).toBeNull();
      trigger.focus();
      fireEvent.click(trigger);
      const menu = view.getByRole("menu", { name: label });
      const settingsItem = view.getByRole("menuitem", { name: settings });
      const feedbackItem = view.getByRole("menuitem", { name: feedback });
      expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(view.getAllByRole("menuitem")).toHaveLength(2);
      expect(view.queryByText("Sign in")).toBeNull();
      expect(document.activeElement).toBe(settingsItem);
      expect(feedbackItem.getAttribute("href")).toBe(feedbackIssueUrl);
      expect(feedbackItem.getAttribute("target")).toBe("_blank");
      expect(feedbackItem.getAttribute("rel")).toBe("noopener noreferrer");

      fireEvent.keyDown(settingsItem, { key: "ArrowDown" });
      expect(document.activeElement).toBe(feedbackItem);
      fireEvent.keyDown(feedbackItem, { key: "ArrowDown" });
      expect(document.activeElement).toBe(settingsItem);
      fireEvent.keyDown(settingsItem, { key: "End" });
      expect(document.activeElement).toBe(feedbackItem);
      fireEvent.keyDown(feedbackItem, { key: "Home" });
      expect(document.activeElement).toBe(settingsItem);
      fireEvent.keyDown(settingsItem, { key: "Escape" });
      expect(view.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(trigger);

      fireEvent.keyDown(trigger, { key: "ArrowUp" });
      fireEvent.click(view.getByRole("menuitem", { name: settings }));
      expect(onOpenSettings).toHaveBeenCalledOnce();
      expect(view.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);
      fireEvent.click(view.getByRole("menuitem", { name: feedback }));
      expect(view.queryByRole("menu")).toBeNull();
      expect(onOpenSettings).toHaveBeenCalledOnce();
      fireEvent.click(trigger);
      fireEvent.pointerDown(document.body);
      expect(view.queryByRole("menu")).toBeNull();
      fireEvent.click(trigger);
      fireEvent.keyDown(view.getByRole("menu"), { key: "Tab" });
      expect(view.queryByRole("menu")).toBeNull();
    } finally {
      cleanup();
      await i18n.changeLanguage(previousLanguage);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
