import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { VoiceInputSampler } from "./VoiceInputSampler";

test("shared sampler reserves countdown space while connection controls are disabled", () => {
  const html = renderToStaticMarkup(
    <VoiceInputSampler
      samples={[]}
      active
      connecting
      recording={false}
      onDiscard={() => {}}
      onFinish={() => {}}
    />,
  );
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).toContain("voice-input-sampler-countdown");
  expect(html).not.toContain("30S");
});
