import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { ComposerToolbar } from "./ComposerToolbar";

test.each([false, true])("toolbar restores full-width sampling while recording=%s", (active) => {
  const control = {
    voice: { status: "listening" },
    dictation: { active, finishing: false, samples: [] },
  } as unknown as VoiceComposerControl;
  const html = renderToStaticMarkup(
    <ComposerToolbar control={control}>
      <button type="button">Normal controls</button>
    </ComposerToolbar>,
  );
  expect(html.includes("Normal controls")).toBe(!active);
  expect(html.includes("voice-input-sampler")).toBe(active);
  expect(html.includes("composer-voice-orb")).toBe(active);
});

test("voice calls cover the toolbar with waveform controls and a rightmost orb", () => {
  const control = {
    voice: { mode: "conversation", status: "connecting" },
  } as unknown as VoiceComposerControl;
  const html = renderToStaticMarkup(
    <ComposerToolbar control={control}>
      <span>Normal controls</span>
    </ComposerToolbar>,
  );
  expect(html).toContain("composer-voice-call");
  expect(html).toContain("composer-voice-orb");
  expect(html).not.toContain("Normal controls");
  expect(html).not.toContain("Discard recording");
});
