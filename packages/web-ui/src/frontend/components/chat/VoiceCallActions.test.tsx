import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { i18n } from "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { VoiceCallActions } from "./VoiceCallActions";

test("task cancellation and call hangup remain distinct from microphone and reading controls", () => {
  const control = {
    voice: {
      mode: "conversation",
      status: "listening",
      muted: false,
      readingPaused: false,
      stop: vi.fn(),
      mute: vi.fn(),
      pauseReading: vi.fn(),
    },
    blocked: false,
    setupComplete: true,
    editing: false,
    steering: false,
  } as unknown as VoiceComposerControl;
  const html = renderToStaticMarkup(<VoiceCallActions control={control} running />);
  expect(html).toContain("Stop task");
  expect(html).toContain("End call");
  expect(html).toContain("Mute microphone");
  expect(html).toContain("Pause spoken replies");
  expect(html).toContain("Use next utterance to correct direction");
});

test.each([true, false])(
  "paused voice resumes only with completed setup: %s",
  async (setupComplete) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const control = {
      voice: {
        mode: "conversation",
        status: "paused",
        stop: vi.fn(),
      },
      start: vi.fn(),
      blocked: false,
      setupComplete,
      editing: false,
      steering: false,
    } as unknown as VoiceComposerControl;
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    try {
      const ui = render(<VoiceCallActions control={control} running={false} />);
      const resume = ui.getByRole("button", { name: i18n.t("voice.resume") }) as HTMLButtonElement;
      expect(resume.disabled).toBe(!setupComplete);
      expect(resume.title).toBe(setupComplete ? "" : i18n.t("voice.setupRequired"));
      const hint = resume.closest(".voice-setup-hint") as HTMLElement | null;
      expect(hint?.title).toBe(setupComplete ? undefined : i18n.t("voice.setupRequired"));
      fireEvent.click(resume);
      if (setupComplete) expect(control.start).toHaveBeenCalledExactlyOnceWith("conversation");
      else expect(control.start).not.toHaveBeenCalled();
      const hangup = ui.getByRole("button", { name: i18n.t("voice.hangup") }) as HTMLButtonElement;
      expect(hangup.disabled).toBe(false);
      fireEvent.click(hangup);
      expect(control.voice.stop).toHaveBeenCalledOnce();
    } finally {
      cleanup();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
