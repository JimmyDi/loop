import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { VoiceControls } from "./VoiceControls";

test("shows active voice status without adding toolbar entry buttons", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const control: VoiceComposerControl = {
    voice: {
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
    blocked: false,
    setupComplete: true,
  };
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    expect(renderToStaticMarkup(<VoiceControls control={control} running={false} />)).toBe("");
    const ui = render(<VoiceControls control={control} running={false} />);
    expect(ui.queryByRole("button")).toBeNull();
    expect(ui.container.querySelector(".voice-controls")).toBeNull();

    control.voice.mode = "conversation";
    control.voice.status = "listening";
    ui.rerender(<VoiceControls control={control} running />);
    expect(ui.getByRole("region", { name: "Start voice call" })).toBeTruthy();
    expect(ui.getByText("Task running")).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Call" })).toBeNull();
    expect(ui.queryByRole("button", { name: "Voice input" })).toBeNull();
    expect(control.start).not.toHaveBeenCalled();
    fireEvent.click(ui.getByRole("button", { name: "End call" }));
    expect(control.voice.stop).toHaveBeenCalledOnce();

    control.voice.mode = undefined;
    control.voice.status = "idle";
    control.notice = "The task has stopped.";
    ui.rerender(<VoiceControls control={control} running={false} />);
    expect(ui.getByRole("status").textContent).toBe(control.notice);
    expect(ui.queryByRole("region")).toBeNull();
    expect(ui.queryByRole("button")).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
