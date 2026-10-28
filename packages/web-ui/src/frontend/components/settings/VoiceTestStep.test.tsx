import type { HTMLButtonElement as TestButton } from "happy-dom";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { VoiceControl, VoiceOptions } from "../../hooks/voice-hook-types";
import { i18n } from "../../i18n/setup";
import { VoiceTestStep } from "./VoiceTestStep";

const state = vi.hoisted(() => ({
  options: undefined as VoiceOptions | undefined,
  control: undefined as VoiceControl | undefined,
}));

vi.mock("../../hooks/useVoice", () => ({
  useVoice: (options: VoiceOptions) => {
    state.options = options;
    return state.control;
  },
}));

vi.mock("../../hooks/useVoiceDevices", () => ({
  useVoiceDevices: () => ({
    selected: "",
    devices: [
      { deviceId: "synthetic-microphone", label: "Synthetic microphone", kind: "audioinput" },
    ],
    select: vi.fn(),
  }),
}));

const voiceControl = (): VoiceControl => ({
  status: "idle",
  text: "",
  muted: false,
  readingPaused: false,
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  speak: vi.fn(),
  finish: vi.fn(),
  endInput: vi.fn(async () => {}),
  interrupt: vi.fn(),
  mute: vi.fn(),
  pauseReading: vi.fn(),
});

test("choosing a different microphone invalidates the previous completed test", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  state.control = voiceControl();
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    const step = view.getByRole("listitem");
    const control = state.control!;
    control.endInput = vi.fn(async () => {
      state.options?.transcript("Synthetic sample", true, "sample", "test");
    });
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.microphone") }));
    control.status = "listening";
    view.rerender(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: i18n.t("voice.stopTest") })),
    );
    expect(step.getAttribute("data-complete")).toBe("true");

    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.inputDevice") }));
    fireEvent.click(view.getByRole("menuitemradio", { name: "Synthetic microphone" }));
    expect(step.getAttribute("data-complete")).toBe("false");
    expect(step.querySelector('[role="img"]')?.getAttribute("data-state")).toBe("incomplete");
  } finally {
    cleanup();
    state.options = undefined;
    state.control = undefined;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each([
  [false, false, true, true],
  [true, false, false, true],
  [true, true, false, false],
] as const)(
  "resource readiness=%s and speech readiness=%s gate the separate real tests",
  async (ready, speechReady, microphoneDisabled, previewDisabled) => {
    state.control = voiceControl();
    const window = new Window();
    try {
      window.document.body.innerHTML = renderToStaticMarkup(
        <ol>
          <VoiceTestStep ready={ready} speechReady={speechReady} />
        </ol>,
      );
      const step = window.document.querySelector("li")!;
      const buttons = step.querySelectorAll<TestButton>(".voice-test-actions button");
      expect(step.querySelector(".voice-setup-step-number")?.textContent).toBe(
        i18n.t("voice.step", { number: 3 }),
      );
      expect(step.getAttribute("data-complete")).toBe("false");
      expect(step.querySelector(".voice-test-step-hint")).toBeNull();
      expect(buttons[0]?.getAttribute("aria-label")).toBe(i18n.t("voice.microphone"));
      expect(buttons[0]?.textContent).toBe("");
      expect(buttons[0]?.disabled).toBe(microphoneDisabled);
      expect(buttons[1]?.getAttribute("aria-label")).toBe(i18n.t("voice.preview"));
      expect(buttons[1]?.textContent).toBe("");
      expect(buttons[1]?.disabled).toBe(previewDisabled);
    } finally {
      await window.happyDOM.close();
    }
  },
);
