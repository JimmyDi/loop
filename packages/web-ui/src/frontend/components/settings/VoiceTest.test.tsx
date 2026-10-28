import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import type { VoiceControl, VoiceOptions } from "../../hooks/voice-hook-types";
import { i18n } from "../../i18n/setup";
import { VoiceTest } from "./VoiceTest";

const runtime = vi.hoisted(() => ({
  control: undefined as VoiceControl | undefined,
  options: undefined as VoiceOptions | undefined,
}));
vi.mock("../../hooks/useVoice", () => ({
  useVoice: (options: VoiceOptions) => {
    if (options.energy) return { status: "idle" };
    runtime.options = options;
    return runtime.control ?? { status: "idle" };
  },
}));

test("microphone and local voice previews remain separate and unavailable without resources", () => {
  const html = renderToStaticMarkup(<VoiceTest disabled />);
  expect(html).toContain("Test microphone");
  expect(html).toContain("Test speech");
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).not.toContain("voice-input-sampler");
  expect(html.match(/class="voice-test-row(?: [^"]*)?"/g)).toHaveLength(2);
});

test("voice preview releases capture after playback without changing microphone test state", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const voice: VoiceControl = {
    status: "idle",
    text: "",
    muted: false,
    readingPaused: false,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    speak: vi.fn(),
    mute: vi.fn(),
    finish: vi.fn(),
    endInput: vi.fn(async () => {}),
    interrupt: vi.fn(),
    pauseReading: vi.fn(),
  };
  runtime.control = voice;
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const changed = vi.fn();
  try {
    const view = render(<VoiceTest disabled={false} onStateChange={changed} />);
    const preview = view.getByRole("button", {
      name: i18n.t("voice.preview"),
    }) as HTMLButtonElement;
    fireEvent.click(preview);
    expect(changed).not.toHaveBeenCalled();
    expect(preview.disabled).toBe(true);
    expect(preview.getAttribute("data-busy")).toBe("true");
    voice.status = "listening";
    view.rerender(<VoiceTest disabled={false} onStateChange={changed} />);
    expect(voice.mute).toHaveBeenCalledWith(true);
    expect(voice.speak).toHaveBeenCalledExactlyOnceWith(i18n.t("voice.sample"));
    expect(view.getByText(i18n.t("voice.sample"))).toBeDefined();
    act(() => runtime.options?.playbackProgress?.(0.5));
    expect(preview.getAttribute("data-busy")).toBe("false");
    expect(view.container.querySelector(".voice-preview-text")?.getAttribute("style")).toContain(
      "50%",
    );
    voice.status = "speaking";
    view.rerender(<VoiceTest disabled={false} onStateChange={changed} />);
    voice.status = "listening";
    await act(async () => view.rerender(<VoiceTest disabled={false} onStateChange={changed} />));
    expect(voice.stop).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
    expect(preview.disabled).toBe(false);
    fireEvent.click(preview);
    voice.error = new Error("voice_synthesis_failed");
    view.rerender(<VoiceTest disabled={false} onStateChange={changed} />);
    expect(changed).not.toHaveBeenCalled();
    expect(preview.disabled).toBe(false);
    expect(view.getByRole("alert")).toBeDefined();
  } finally {
    cleanup();
    runtime.control = undefined;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
