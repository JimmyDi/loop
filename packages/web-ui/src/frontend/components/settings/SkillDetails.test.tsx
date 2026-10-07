import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { JSDOM } from "jsdom";

import { i18n } from "../../i18n/setup";
import type { useSkills } from "../../hooks/useSkills";
import { Modal } from "../ui/Modal";
import { SkillDetails } from "./SkillDetails";

const skill = {
  id: "a".repeat(24),
  name: "example",
  handle: "example-" + "a".repeat(24),
  description: "Review source",
  path: "skills/example/SKILL.md",
  enabled: true,
  modelInvocable: true,
  managed: true,
  scope: "personal" as const,
  source: { kind: "created" as const },
  content:
    "## Review steps\n\n- Read the source.\n- Verify **behavior**.\n\n<script>invalid()</script>",
  files: ["SKILL.md", "references/guide.md"],
};

test("skill modal renders instructions and keeps failed actions open", async () => {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup, act, within } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const toggle = vi.fn(async () => {});
    const remove = vi.fn(async (): Promise<void> => {
      throw new Error("Cannot uninstall");
    });
    const api = { toggle, remove } as unknown as ReturnType<typeof useSkills>;
    const close = vi.fn();
    const use = vi.fn();
    const props = { skill, api, onClose: close, onUpdate: vi.fn(), onUse: use };
    const view = render(<SkillDetails {...props} />);
    const dialog = view.getByRole("dialog", { name: "example" });
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getByText("Review steps", { exact: false })).toBeTruthy();
    expect(dialog.querySelectorAll(".markdown-text li")).toHaveLength(2);
    expect(dialog.querySelector("script")).toBeNull();
    expect(within(dialog).getByText("references/guide.md", { exact: false })).toBeTruthy();
    await act(async () => fireEvent.click(view.getByRole("switch")));
    expect(toggle).toHaveBeenCalledWith(skill.id, false);
    expect(view.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(view.getByRole("button", { name: "Use in chat" }).hasAttribute("disabled")).toBe(true);
    await act(async () => fireEvent.click(view.getByRole("switch")));
    fireEvent.click(view.getByRole("button", { name: "Use in chat" }));
    expect(use).toHaveBeenCalledOnce();
    fireEvent.click(view.getByRole("button", { name: "Uninstall" }));
    expect(remove).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Uninstall" })));
    expect(view.getByRole("alert").textContent).toContain("Cannot uninstall");
    expect(close).not.toHaveBeenCalled();
    remove.mockResolvedValueOnce(undefined);
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Uninstall" })));
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<SkillDetails {...props} skill={{ ...skill, managed: false }} />);
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(view.getByText(/Managed outside Loop/)).toBeTruthy();
    expect(view.queryByRole("button", { name: "Uninstall" })).toBeNull();
  } finally {
    await act(async () => {
      cleanup();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    window.close();
  }
});

test("nested skill dialog restores list focus and keeps Settings open on Escape", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const parentClose = vi.fn();
    const close = vi.fn();
    const update = vi.fn();
    let complete: (() => void) | undefined;
    const api = {
      toggle: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      ),
      update: vi.fn(async () => ({ id: "update-job", status: "ready", stage: "checking" })),
    } as unknown as ReturnType<typeof useSkills>;
    const background = (
      <Modal title="Settings" onClose={parentClose}>
        <button type="button">View example</button>
      </Modal>
    );
    const view = render(background);
    const row = view.getByRole("button", { name: "View example" });
    row.focus();
    const props = {
      skill: { ...skill, source: { kind: "github" as const } },
      api,
      onClose: close,
      onUpdate: update,
    };
    view.rerender(
      <>
        {background}
        <SkillDetails {...props} />
      </>,
    );
    const dialog = view.getByRole("dialog", { name: "example" });
    fireEvent.click(view.getByRole("switch"));
    fireEvent(
      dialog,
      new window.Event("cancel", { bubbles: true, cancelable: true }) as unknown as Event,
    );
    expect(close).not.toHaveBeenCalled();
    expect(parentClose).not.toHaveBeenCalled();
    await act(async () => complete?.());
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Update" })));
    expect(update).toHaveBeenCalledWith({ id: "update-job", status: "ready", stage: "checking" });
    fireEvent(
      dialog,
      new window.Event("cancel", { bubbles: true, cancelable: true }) as unknown as Event,
    );
    expect(close).toHaveBeenCalledOnce();
    expect(parentClose).not.toHaveBeenCalled();
    view.rerender(background);
    expect(document.activeElement).toBe(row);
  } finally {
    await act(async () => {
      cleanup();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
