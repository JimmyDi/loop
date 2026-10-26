import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { i18n } from "../../i18n/setup";
import type { VoiceResourceActionsProps } from "./voice-resource-actions-types";
import { VoiceResourceActions } from "./VoiceResourceActions";

test("partial installations can be cleared while active mutations disable conflicting controls", () => {
  const props = {
    profile: "conversation" as const,
    disabled: false,
    pending: false,
    active: false,
    loaded: true,
    execute: vi.fn(async () => {}),
  };
  const html = renderToStaticMarkup(<VoiceResourceActions {...props} />);
  expect(html.match(/<button[^>]*aria-label="Uninstall"[^>]*>/)?.[0]).not.toContain("disabled");
  const busy = renderToStaticMarkup(<VoiceResourceActions {...props} active />);
  expect(busy.match(/<button[^>]*aria-label="Uninstall"[^>]*>/)?.[0]).toContain("disabled");
  expect(busy).toContain("Cancel download");
});

test("icon actions retain accessible names and titles and dispatch the selected profile", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const execute = vi.fn(async () => {});
  const props: VoiceResourceActionsProps = {
    status: {
      supported: true,
      installed: true,
      ttsInstalled: true,
      localManagement: true,
      engineAvailable: true,
      updateAvailable: true,
      phase: "idle",
    },
    profile: "input",
    disabled: false,
    pending: false,
    active: false,
    loaded: true,
    execute,
  };
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  try {
    const view = render(<VoiceResourceActions {...props} />);
    for (const [action, label] of [
      ["install", "repair"],
      ["update", "update"],
      ["uninstall", "uninstall"],
    ] as const) {
      const name = i18n.t("voice." + label);
      const button = view.getByRole("button", { name });
      expect(button.title).toBe(name);
      expect(button.parentElement?.title).toBe(name);
      expect(button.textContent).toBe("");
      expect(button.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
      fireEvent.click(button);
      expect(execute).toHaveBeenLastCalledWith({ action, profile: "input" });
    }
    view.rerender(<VoiceResourceActions {...props} active />);
    const cancel = view.getByRole("button", { name: i18n.t("voice.cancel") });
    expect((cancel as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cancel);
    expect(execute).toHaveBeenLastCalledWith({ action: "cancel", profile: "input" });
    view.rerender(<VoiceResourceActions {...props} active pending />);
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<VoiceResourceActions {...props} active cancellable={false} />);
    expect(view.queryByRole("button", { name: i18n.t("voice.cancel") })).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
