import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import type { VoiceDictationControl } from "../../hooks/voice-dictation-types";
import type { VoiceControl } from "../../hooks/voice-hook-types";
import { VoiceInputRecording } from "./VoiceInputRecording";

test("shared recording disables actions while connecting", () => {
  const input = { active: true, finishing: false, samples: [] } as unknown as VoiceDictationControl;
  const voice = { status: "connecting" } as VoiceControl;
  const html = renderToStaticMarkup(
    <VoiceInputRecording input={input} voice={voice} durationSeconds={60} onDiscard={() => {}} />,
  );
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).not.toContain("60S");
});
