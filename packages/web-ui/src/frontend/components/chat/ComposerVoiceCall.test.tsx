// @vitest-environment happy-dom
import { fireEvent, render, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { ComposerVoiceCall } from "./ComposerVoiceCall";

afterEach(cleanup);

test("connecting animation gives way to live waveform and Stop hangs up", () => {
  const stop = vi.fn();
  const control = {
    voice: { mode: "conversation", status: "connecting", stop },
    callSamples: [0.1],
  } as unknown as VoiceComposerControl;
  const view = render(<ComposerVoiceCall control={control} />);
  expect(view.container.querySelector(".composer-voice-call-wait")).not.toBeNull();
  expect(view.getAllByRole("button")).toHaveLength(4);
  control.voice.status = "listening";
  view.rerender(<ComposerVoiceCall control={control} />);
  expect(view.container.querySelector(".composer-voice-call-wait")).toBeNull();
  expect(view.container.querySelector(".voice-sample-waveform[data-active=true]")).not.toBeNull();
  fireEvent.click(view.getByRole("button", { name: "End call" }));
  expect(stop).toHaveBeenCalledOnce();
});

test("call icons toggle microphone, reading and correction without ending the call", () => {
  const control = {
    voice: {
      mode: "conversation",
      status: "listening",
      muted: false,
      readingPaused: false,
      mute: vi.fn(),
      pauseReading: vi.fn(),
      stop: vi.fn(),
    },
    steering: false,
    setSteering: vi.fn(),
    setupComplete: true,
  } as unknown as VoiceComposerControl;
  const view = render(<ComposerVoiceCall control={control} />);
  fireEvent.click(view.getByRole("button", { name: "Mute microphone" }));
  fireEvent.click(view.getByRole("button", { name: "Pause spoken replies" }));
  fireEvent.click(view.getByRole("button", { name: "Use next utterance to correct direction" }));
  expect(control.voice.mute).toHaveBeenCalledWith(true);
  expect(control.voice.pauseReading).toHaveBeenCalledWith(true);
  expect(control.setSteering).toHaveBeenCalledWith(true);
  expect(control.voice.stop).not.toHaveBeenCalled();
  control.voice.muted = true;
  control.voice.readingPaused = true;
  control.steering = true;
  view.rerender(<ComposerVoiceCall control={control} />);
  expect(view.getByRole("button", { name: "Unmute microphone" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(
    view.getByRole("button", { name: "Resume spoken replies" }).getAttribute("aria-pressed"),
  ).toBe("true");
});
