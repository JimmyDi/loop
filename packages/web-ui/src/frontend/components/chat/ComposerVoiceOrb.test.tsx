import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { ComposerVoiceOrb } from "./ComposerVoiceOrb";
import "../../i18n/setup";

test("orb uses live microphone energy for both voice modes and stays still when muted", () => {
  const control = {
    voice: { mode: "dictation", status: "listening", muted: false },
    dictation: { samples: [0.075] },
    callSamples: [0.15],
  } as unknown as VoiceComposerControl;
  expect(renderToStaticMarkup(<ComposerVoiceOrb control={control} />)).toContain(
    "--voice-level:0.5",
  );
  control.voice.mode = "conversation";
  expect(renderToStaticMarkup(<ComposerVoiceOrb control={control} />)).toContain("--voice-level:1");
  control.voice.muted = true;
  expect(renderToStaticMarkup(<ComposerVoiceOrb control={control} />)).toContain("--voice-level:0");
});
