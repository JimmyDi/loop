import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import type { VoiceControl, VoiceOptions } from "../../hooks/voice-hook-types";
import { i18n } from "../../i18n/setup";
import { VoiceInputTest } from "./VoiceInputTest";

const runtime = vi.hoisted(() => ({
  options: undefined as VoiceOptions | undefined,
  control: undefined as VoiceControl | undefined,
}));
vi.mock("../../hooks/useVoice", () => ({
  useVoice: (options: VoiceOptions) => {
    runtime.options = options;
    return runtime.control;
  },
}));

test("samples energy, retries without restarting and waits for all final text", async () => {
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
    endInput: vi.fn(async () => {
      runtime.options?.transcript("Final sample", true, "one", "test");
    }),
    finish: vi.fn(),
    speak: vi.fn(),
    mute: vi.fn(),
    interrupt: vi.fn(),
    pauseReading: vi.fn(),
  };
  runtime.control = voice;
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const onStateChange = vi.fn();
  try {
    const view = render(<VoiceInputTest disabled={false} onStateChange={onStateChange} />);
    const microphone = view.getByRole("button", {
      name: i18n.t("voice.microphone"),
    }) as HTMLButtonElement;
    expect(view.container.querySelector(".voice-input-sampler")).toBeNull();
    expect(view.queryByText("30S")).toBeNull();
    fireEvent.click(microphone);
    expect(voice.start).toHaveBeenCalledWith("test");
    expect(microphone.disabled).toBe(true);
    expect(microphone.getAttribute("data-busy")).toBe("true");
    voice.status = "connecting";
    view.rerender(<VoiceInputTest disabled={false} onStateChange={onStateChange} />);
    expect(view.container.querySelector(".voice-input-sampler")).toBeNull();
    expect(view.queryByRole("button", { name: i18n.t("voice.stopTest") })).toBeNull();
    expect(view.queryByRole("button", { name: i18n.t("voice.retry") })).toBeNull();
    expect(voice.stop).not.toHaveBeenCalled();
    voice.status = "listening";
    view.rerender(<VoiceInputTest disabled={false} onStateChange={onStateChange} />);
    let stop = view.getByRole("button", { name: i18n.t("voice.stopTest") }) as HTMLButtonElement;
    const discard = view.getByRole("button", { name: i18n.t("voice.discardTest") });
    expect(stop.disabled).toBe(false);
    expect(view.getByText("30S").parentElement?.parentElement?.className).toBe(
      "voice-input-test-controls",
    );
    expect((discard as HTMLButtonElement).disabled).toBe(false);
    expect(
      view.container.querySelector(".voice-input-sampler-capsule")?.getAttribute("data-active"),
    ).toBe("true");
    expect(microphone.getAttribute("data-busy")).toBe("false");
    vi.useFakeTimers();
    act(() => runtime.options?.energy?.(0.001));
    expect(microphone.getAttribute("data-busy")).toBe("false");
    await act(async () => vi.advanceTimersByTimeAsync(70));
    act(() => runtime.options?.energy?.(0.1));
    expect(microphone.getAttribute("data-busy")).toBe("true");
    const waveformTop = Number(
      view.container.querySelector(".voice-sample-waveform line:last-child")?.getAttribute("y1"),
    );
    expect(waveformTop).toBeGreaterThan(2);
    expect(waveformTop).toBeLessThan(15.75);
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(microphone.getAttribute("data-busy")).toBe("true");
    act(() => runtime.options?.energy?.(0.008));
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(microphone.getAttribute("data-busy")).toBe("true");
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(microphone.getAttribute("data-busy")).toBe("false");
    vi.useRealTimers();
    act(() => runtime.options?.transcript("Discard me", true, "old", "test"));
    expect(onStateChange).not.toHaveBeenCalledWith("verified");
    await act(async () => fireEvent.click(discard));
    expect(voice.stop).toHaveBeenCalledOnce();
    expect(view.container.querySelector(".voice-input-sampler")).toBeNull();
    expect(view.queryByRole("button", { name: i18n.t("voice.retry") })).toBeNull();
    act(() => runtime.options?.transcript("Late discarded text", true, "late", "test"));
    expect(view.queryByLabelText(i18n.t("voice.final"))).toBeNull();
    fireEvent.click(microphone);
    expect(voice.start).toHaveBeenCalledTimes(2);
    const finishing = Promise.withResolvers<void>();
    voice.endInput = vi.fn(async () => {
      await finishing.promise;
      runtime.options?.transcript("Final sample", true, "one", "test");
    });
    voice.status = "transcribing";
    view.rerender(<VoiceInputTest disabled={false} onStateChange={onStateChange} />);
    stop = view.getByRole("button", { name: i18n.t("voice.stopTest") }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    expect(microphone.getAttribute("data-busy")).toBe("false");
    fireEvent.click(stop);
    expect(stop.disabled).toBe(true);
    expect(view.queryByLabelText(i18n.t("voice.final"))).toBeNull();
    act(() => runtime.options?.transcript("Earlier phrase", true, "earlier", "test"));
    expect(view.queryByLabelText(i18n.t("voice.final"))).toBeNull();
    expect(microphone.getAttribute("data-busy")).toBe("true");
    await act(async () => finishing.resolve());
    expect(voice.endInput).toHaveBeenCalledOnce();
    expect(view.getByLabelText(i18n.t("voice.final")).textContent).toBe(
      "Earlier phrase Final sample",
    );
    expect(onStateChange).toHaveBeenLastCalledWith("verified");
    expect(view.queryByRole("status")).toBeNull();
    expect(view.container.querySelector(".voice-input-sampler-countdown")?.textContent).toBe("");
    expect(view.getByLabelText(i18n.t("voice.final")).parentElement?.className).toBe(
      "voice-input-test-controls",
    );
    expect(view.queryByRole("button", { name: i18n.t("voice.stopTest") })).toBeNull();
    expect(view.container.querySelector(".voice-sample-waveform")).toBeNull();
    expect(microphone.disabled).toBe(false);
    view.rerender(<VoiceInputTest disabled={false} onStateChange={onStateChange} />);
    expect(view.getByLabelText(i18n.t("voice.final")).textContent).toBe(
      "Earlier phrase Final sample",
    );
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: i18n.t("voice.retry") })),
    );
    expect(view.queryByLabelText(i18n.t("voice.final"))).toBeNull();
    expect(voice.start).toHaveBeenCalledTimes(2);
    expect(voice.mute).toHaveBeenCalledWith(false);
    expect(view.container.querySelector(".voice-input-sampler")).not.toBeNull();
    expect(view.getByRole("button", { name: i18n.t("voice.discardTest") })).toBeDefined();
    expect(view.queryByRole("button", { name: i18n.t("voice.retry") })).toBeNull();
  } finally {
    cleanup();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
