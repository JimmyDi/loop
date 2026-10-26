import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";
import { VoiceCallPanel } from "./VoiceCallPanel";

test("call panel shows transcript editing and independent task status", () => {
  const control = {
    voice: {
      mode: "conversation",
      status: "speaking",
      text: "Check the types",
      muted: false,
      readingPaused: false,
    },
    blocked: false,
    editing: false,
    steering: false,
  } as unknown as VoiceComposerControl;
  const html = renderToStaticMarkup(<VoiceCallPanel control={control} running />);
  expect(html).toContain("Speaking");
  expect(html).toContain("Task running");
  expect(html).toContain("Check the types");
  expect(html).toContain("Edit text");
  expect(html).toContain("Your typed draft and attachments stay separate");
});
