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
    await act(async () =>
      state.options?.transcript("Synthetic first microphone", true, "one", "test"),
    );
    expect(step.getAttribute("data-complete")).toBe("true");
    fireEvent.change(view.getByRole("combobox", { name: i18n.t("voice.inputDevice") }), {
      target: { value: "synthetic-microphone" },
    });
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
      const buttons = step.querySelectorAll<TestButton>("button");
      expect(step.querySelector(".voice-setup-step-number")?.textContent).toBe(
        i18n.t("voice.step", { number: 3 }),
      );
      expect(step.getAttribute("data-complete")).toBe("false");
      expect(step.querySelector(".voice-test-step-hint")?.textContent).toBe(
        i18n.t(ready ? "voice.testHint" : "voice.testLocked"),
      );
      expect(buttons[0]?.textContent).toBe(i18n.t("voice.microphone"));
      expect(buttons[0]?.disabled).toBe(microphoneDisabled);
      expect(buttons[1]?.textContent).toBe(i18n.t("voice.preview"));
      expect(buttons[1]?.disabled).toBe(previewDisabled);
    } finally {
      await window.happyDOM.close();
    }
  },
);

test("a real test completes only after nonempty final recognition and can retry after failure", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const voice = voiceControl();
  state.control = voice;
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    const step = view.getByRole("listitem");
    const marker = () => step.querySelector('[role="img"]')!;
    expect(step.getAttribute("data-complete")).toBe("false");
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.microphone") }));
    expect(voice.start).toHaveBeenCalledWith("test");
    expect(marker().getAttribute("data-state")).toBe("loading");
    voice.mode = "test";
    voice.status = "listening";
    view.rerender(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    await act(async () => state.options?.transcript("Synthetic partial", false, "one", "test"));
    expect(step.getAttribute("data-complete")).toBe("false");
    await act(async () => state.options?.transcript("  ", true, "empty", "test"));
    expect(step.getAttribute("data-complete")).toBe("false");
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.preview") }));
    expect(voice.speak).toHaveBeenCalledWith(i18n.t("voice.sample"));
    expect(step.getAttribute("data-complete")).toBe("false");
    await act(async () =>
      state.options?.transcript("Synthetic recognized phrase", true, "final", "test"),
    );
    expect(step.getAttribute("data-complete")).toBe("true");
    expect(marker().getAttribute("data-state")).toBe("completed");
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.stopTest") }));
    expect(voice.stop).toHaveBeenCalledOnce();
    voice.mode = undefined;
    voice.status = "idle";
    view.rerender(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    expect(step.getAttribute("data-complete")).toBe("true");
    expect(marker().getAttribute("data-state")).toBe("completed");
    voice.error = new Error("microphone_unavailable");
    view.rerender(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    expect(marker().getAttribute("data-state")).toBe("failed");
    expect(step.getAttribute("data-complete")).toBe("false");
    expect(view.getByRole("alert").closest("li")).toBe(step);
    voice.error = undefined;
    voice.mode = undefined;
    voice.status = "idle";
    view.rerender(
      <ol>
        <VoiceTestStep ready speechReady />
      </ol>,
    );
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.microphone") }));
    expect(voice.start).toHaveBeenCalledTimes(2);
    expect(marker().getAttribute("data-state")).toBe("loading");
    await act(async () =>
      state.options?.transcript("Synthetic retry phrase", true, "retry", "test"),
    );
    expect(step.getAttribute("data-complete")).toBe("true");
    view.rerender(
      <ol>
        <VoiceTestStep ready={false} speechReady={false} />
      </ol>,
    );
    expect(step.getAttribute("data-complete")).toBe("false");
    expect(
      (view.getByRole("button", { name: i18n.t("voice.microphone") }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  } finally {
    cleanup();
    state.options = undefined;
    state.control = undefined;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["stop", "error", "paused"] as const)(
  "pending preview clears on %s and never plays during a later microphone test",
  async (interruption) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const voice = voiceControl();
    state.control = voice;
    const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <ol>
          <VoiceTestStep ready speechReady />
        </ol>,
      );
      const step = view.getByRole("listitem");
      fireEvent.click(view.getByRole("button", { name: i18n.t("voice.preview") }));
      expect(voice.start).toHaveBeenCalledWith("test");
      voice.mode = "test";
      voice.status = "connecting";
      view.rerender(
        <ol>
          <VoiceTestStep ready speechReady />
        </ol>,
      );
      if (interruption === "stop")
        fireEvent.click(view.getByRole("button", { name: i18n.t("voice.stopTest") }));
      else {
        if (interruption === "error") voice.error = new Error("synthetic preview failure");
        else voice.status = "paused";
        view.rerender(
          <ol>
            <VoiceTestStep ready speechReady />
          </ol>,
        );
        expect(step.querySelector('[role="img"]')?.getAttribute("data-state")).toBe("failed");
      }
      expect(step.getAttribute("data-complete")).toBe("false");
      voice.mode = undefined;
      voice.error = undefined;
      voice.status = "idle";
      view.rerender(
        <ol>
          <VoiceTestStep ready speechReady />
        </ol>,
      );
      fireEvent.click(view.getByRole("button", { name: i18n.t("voice.microphone") }));
      voice.mode = "test";
      voice.status = "listening";
      view.rerender(
        <ol>
          <VoiceTestStep ready speechReady />
        </ol>,
      );
      expect(voice.speak).not.toHaveBeenCalled();
      expect(step.getAttribute("data-complete")).toBe("false");
    } finally {
      cleanup();
      state.options = undefined;
      state.control = undefined;
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
