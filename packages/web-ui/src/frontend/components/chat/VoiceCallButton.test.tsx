import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { i18n } from "../../i18n/setup";
import { VoiceCallButton } from "./VoiceCallButton";

test.each([
  ["idle", undefined, true, false, false, false],
  ["blocked", undefined, true, true, false, true],
  ["editing a queued message", undefined, true, false, true, true],
  ["dictating", "dictation", true, false, false, true],
  ["already calling", "conversation", true, false, false, true],
  ["testing speech", "test", true, false, false, true],
  ["setup incomplete", undefined, false, false, false, true],
] as const)(
  "toolbar Call action while %s",
  async (_name, mode, setupComplete, blocked, editing, disabled) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const control: VoiceComposerControl = {
      voice: {
        mode,
        status: mode ? "listening" : "idle",
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
      },
      start: vi.fn(),
      steering: false,
      setSteering: vi.fn(),
      notice: "",
      editTranscript: vi.fn(),
      stopTask: vi.fn(),
      editing,
      prompt: {
        submitted: false,
        text: "",
        images: [],
        files: [],
        setText: vi.fn(),
        submit: vi.fn(async () => {}),
        submitText: vi.fn(async () => "accepted" as const),
        pending: false,
        error: undefined,
        uncertain: false,
      },
      blocked,
      setupComplete,
    };
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    try {
      const ui = render(<VoiceCallButton control={control} />);
      const call = ui.getByRole("button", { name: "Call" }) as HTMLButtonElement;
      expect(call.textContent).toBe("");
      expect(call.classList.contains("icon")).toBe(true);
      expect(call.title).toBe(i18n.t(setupComplete ? "voice.conversation" : "voice.setupRequired"));
      const hint = call.closest(".voice-setup-hint") as HTMLElement | null;
      expect(hint?.title).toBe(setupComplete ? undefined : i18n.t("voice.setupRequired"));
      expect(call.disabled).toBe(disabled);
      expect(call.getAttribute("aria-pressed")).toBe(String(mode === "conversation"));
      fireEvent.click(call);
      if (disabled) expect(control.start).not.toHaveBeenCalled();
      else expect(control.start).toHaveBeenCalledExactlyOnceWith("conversation");
      expect(control.prompt.submit).not.toHaveBeenCalled();
      expect(control.prompt.submitText).not.toHaveBeenCalled();
    } finally {
      cleanup();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
