import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
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
