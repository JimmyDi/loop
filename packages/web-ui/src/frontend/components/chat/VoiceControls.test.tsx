import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { VoiceControls } from "./VoiceControls";

test("call entry portals into the header and shares active state with the composer panel", async () => {
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
  };
  const { render, fireEvent, within, cleanup } = await import("@testing-library/react/pure");
  const header = document.createElement("header");
  document.body.append(header);
  try {
    expect(renderToStaticMarkup(<VoiceControls control={control} running={false} />)).toBe("");
    const ui = render(<VoiceControls control={control} running={false} actions={header} />);
    const call = within(header).getByRole("button", { name: "Call" }) as HTMLButtonElement;
    expect(call.disabled).toBe(false);
    expect(within(ui.container).queryByRole("button")).toBeNull();
    expect(ui.container.querySelector(".voice-controls")).toBeNull();
    fireEvent.click(call);
    expect(control.start).toHaveBeenCalledExactlyOnceWith("conversation");

    control.voice.mode = "conversation";
    control.voice.status = "listening";
    ui.rerender(<VoiceControls control={control} running actions={header} />);
    expect(call.disabled).toBe(true);
    expect(call.getAttribute("aria-pressed")).toBe("true");
    expect(within(ui.container).getByRole("region", { name: "Start voice call" })).toBeTruthy();
    expect(within(ui.container).getByText("Task running")).toBeTruthy();
    expect(within(ui.container).queryByRole("button", { name: "Call" })).toBeNull();
    fireEvent.click(within(ui.container).getByRole("button", { name: "End call" }));
    expect(control.voice.stop).toHaveBeenCalledOnce();
    ui.unmount();
    expect(header.childElementCount).toBe(0);
  } finally {
    cleanup();
    header.remove();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
