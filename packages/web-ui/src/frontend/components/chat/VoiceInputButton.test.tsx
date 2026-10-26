import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { i18n } from "../../i18n/setup";
import { VoiceInputButton } from "./VoiceInputButton";

test.each([
  ["idle starts dictation", undefined, "idle", false, false, "start"],
  ["active finishes input", "dictation", "listening", false, false, "finish"],
  ["paused resumes dictation", "dictation", "paused", false, false, "start"],
  ["blocked cannot start", undefined, "idle", true, true, "none"],
  ["conversation cannot start dictation", "conversation", "listening", false, true, "none"],
  ["blocked active input can finish", "dictation", "listening", true, false, "finish"],
  ["blocked paused input cannot resume", "dictation", "paused", true, true, "none"],
  ["live transcribing input can finish", "dictation", "transcribing", false, false, "finish"],
] as const)(
  "dictation button: %s without sending the prompt",
  async (_name, mode, status, blocked, disabled, action) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const control: VoiceComposerControl = {
      voice: {
        mode,
        status,
        text: "Synthetic editable draft",
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
      editing: false,
      prompt: {
        submitted: false,
        text: "Synthetic editable draft",
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
    };
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    try {
      const view = render(<VoiceInputButton control={control} />);
      const label =
        mode === "dictation"
          ? status === "paused"
            ? "voice.resume"
            : "voice.stopInput"
          : "voice.dictation";
      const button = view.getByRole("button", { name: i18n.t(label) }) as HTMLButtonElement;
      expect(button.disabled).toBe(disabled);
      expect(button.textContent).toBe("");
      expect(button.title).toBe(i18n.t(label));
      expect(button.getAttribute("aria-pressed")).toBe(String(mode === "dictation"));
      fireEvent.click(button);
      if (action === "start") {
        expect(control.start).toHaveBeenCalledExactlyOnceWith("dictation");
      } else {
        expect(control.start).not.toHaveBeenCalled();
      }
      expect(control.voice.endInput).toHaveBeenCalledTimes(action === "finish" ? 1 : 0);
      expect(control.voice.stop).not.toHaveBeenCalled();
      expect(control.prompt.submit).not.toHaveBeenCalled();
      expect(control.prompt.submitText).not.toHaveBeenCalled();
      expect(control.prompt.setText).not.toHaveBeenCalled();
    } finally {
      cleanup();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
