import type { HTMLButtonElement as TestButton } from "happy-dom";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { VoiceStatus } from "../../../shared/voice";
import type { VoiceSettingsControl } from "../../hooks/voice-settings-types";
import { i18n } from "../../i18n/setup";
import { VoiceResourceStep } from "./VoiceResourceStep";

const settingsFor = (status: VoiceStatus): VoiceSettingsControl =>
  ({
    query: {
      data: status,
      isPending: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      refetch: vi.fn(async () => {}),
    },
    execute: vi.fn(async () => {}),
    pending: false,
  }) as unknown as VoiceSettingsControl;

test.each([
  ["input", false, true, false],
  ["input", true, false, true],
  ["conversation", true, false, false],
  ["conversation", true, true, true],
] as const)(
  "profile=%s installed=%s tts=%s completes only from all required resources",
  async (profile, installed, ttsInstalled, complete) => {
    const window = new Window();
    try {
      const settings = settingsFor({
        supported: true,
        installed,
        ttsInstalled,
        localManagement: true,
        engineAvailable: true,
        phase: "idle",
      });
      window.document.body.innerHTML = renderToStaticMarkup(
        <ol>
          <VoiceResourceStep settings={settings} profile={profile} />
        </ol>,
      );
      const step = window.document.querySelector("li")!;
      expect(step.getAttribute("data-complete")).toBe(String(complete));
      expect(step.querySelector(".voice-setup-step-number")?.textContent).toBe(
        i18n.t("voice.step", { number: 2 }),
      );
      expect(step.querySelector("h4")?.textContent).toBe(i18n.t("voice.installResources"));
      const action = step.querySelector<TestButton>(
        'button[aria-label="' +
          i18n.t("voice." + (installed && ttsInstalled ? "uninstall" : "install")) +
          '"]',
      );
      expect(action?.disabled).toBe(false);
      expect(step.querySelector('[role="progressbar"]')).toBeNull();
    } finally {
      await window.happyDOM.close();
    }
  },
);

test.each(["install", "update", "uninstall"] as const)(
  "requested %s shows activity in resource step before server state catches up",
  async (requested) => {
    const window = new Window();
    try {
      const settings = {
        ...settingsFor({
          supported: true,
          installed: true,
          ttsInstalled: true,
          localManagement: true,
          engineAvailable: true,
          phase: "idle",
        }),
        pending: true,
        requested,
      };
      window.document.body.innerHTML = renderToStaticMarkup(
        <ol>
          <VoiceResourceStep settings={settings} profile="conversation" />
        </ol>,
      );
      const step = window.document.querySelector("li")!;
      expect(step.querySelector('[role="img"]')?.getAttribute("data-state")).toBe("loading");
      expect(step.getAttribute("data-complete")).toBe("false");
      expect(step.querySelector(".voice-download-progress")).toBeNull();
      const cancel = step.querySelector<TestButton>(
        'button[aria-label="' + i18n.t("voice.cancel") + '"]',
      );
      expect(!!cancel).toBe(requested !== "uninstall");
      for (const button of step.querySelectorAll<TestButton>(".voice-settings-actions button"))
        expect(button.disabled).toBe(true);
    } finally {
      await window.happyDOM.close();
    }
  },
);

test("server download progress and installation errors remain inside step two", async () => {
  const window = new Window();
  try {
    const settings = settingsFor({
      supported: true,
      installed: false,
      localManagement: true,
      engineAvailable: true,
      phase: "updating",
      download: { received: 1048576, total: 2097152 },
    });
    window.document.body.innerHTML = renderToStaticMarkup(
      <ol>
        <VoiceResourceStep settings={settings} profile="input" />
      </ol>,
    );
    expect(window.document.querySelector(".voice-download-progress")).toBeNull();
    const cancel = window.document.querySelector<TestButton>(
      'button[aria-label="' + i18n.t("voice.cancel") + '"]',
    );
    expect(cancel?.disabled).toBe(false);
    const failedSettings = {
      ...settingsFor({
        ...settings.query.data!,
        phase: "error",
        download: undefined,
      }),
      error: new Error("synthetic failure"),
    };
    window.document.body.innerHTML = renderToStaticMarkup(
      <ol>
        <VoiceResourceStep settings={failedSettings} profile="input" />
      </ol>,
    );
    const issue = window.document.querySelector('[role="alert"]')!;
    expect(issue.closest("li")).toBe(window.document.querySelector("li"));
    expect(issue.textContent).toBe(i18n.t("voice.installFailed"));
    expect(window.document.querySelector('[role="img"]')?.getAttribute("data-state")).toBe(
      "failed",
    );
    expect(window.document.querySelector('[role="progressbar"]')).toBeNull();
    expect(
      window.document.querySelector<TestButton>(
        'button[aria-label="' + i18n.t("voice.install") + '"]',
      )?.disabled,
    ).toBe(false);
  } finally {
    await window.happyDOM.close();
  }
});

test("failed status check gates resource actions and retry restores the current state", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const settings = settingsFor({
    supported: true,
    installed: true,
    ttsInstalled: true,
    localManagement: true,
    engineAvailable: true,
    phase: "idle",
  });
  const query = {
    ...settings.query,
    isError: true,
    isSuccess: false,
  } as unknown as VoiceSettingsControl["query"];
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <ol>
        <VoiceResourceStep settings={{ ...settings, query }} profile="conversation" />
      </ol>,
    );
    expect(view.getByRole("alert").textContent).toBe(i18n.t("voice.settingsFailed"));
    expect(view.getByRole("listitem").getAttribute("data-complete")).toBe("false");
    expect(
      (view.getByRole("button", { name: i18n.t("voice.uninstall") }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.retry") }));
    expect(query.refetch).toHaveBeenCalledOnce();
    view.rerender(
      <ol>
        <VoiceResourceStep
          settings={{ ...settings, query: { ...query, isFetching: true } }}
          profile="conversation"
        />
      </ol>,
    );
    expect(
      view.getByRole("listitem").querySelector('[role="img"]')?.getAttribute("data-state"),
    ).toBe("loading");
    expect(
      (view.getByRole("button", { name: i18n.t("voice.retry") }) as HTMLButtonElement).disabled,
    ).toBe(true);
    view.rerender(
      <ol>
        <VoiceResourceStep settings={settings} profile="conversation" />
      </ol>,
    );
    expect(view.queryByRole("alert")).toBeNull();
    expect(view.queryByRole("button", { name: i18n.t("voice.retry") })).toBeNull();
    expect(view.getByRole("listitem").getAttribute("data-complete")).toBe("true");
    expect(
      (view.getByRole("button", { name: i18n.t("voice.uninstall") }) as HTMLButtonElement).disabled,
    ).toBe(false);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("paused installation does not display a cancellation failure", () => {
  const settings = {
    ...settingsFor({
      supported: true,
      installed: false,
      localManagement: true,
      engineAvailable: true,
      phase: "paused",
    }),
    error: new Error("voice_install_paused"),
  };
  const html = renderToStaticMarkup(
    <ol>
      <VoiceResourceStep settings={settings} profile="conversation" />
    </ol>,
  );
  expect(html).not.toContain('role="alert"');
  expect(html).toContain('aria-label="Resume installation"');
});
