import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { ComposerVoiceInput } from "./ComposerVoiceInput";

test("composer dictation uses the shared sampler without a call panel", () => {
  const control = {
    voice: { status: "listening" },
    dictation: { active: true, finishing: false, samples: [] },
  } as unknown as VoiceComposerControl;
  const html = renderToStaticMarkup(<ComposerVoiceInput control={control} />);
  expect(html).toContain("voice-input-sampler");
  expect(html).not.toContain("voice-call");
});
