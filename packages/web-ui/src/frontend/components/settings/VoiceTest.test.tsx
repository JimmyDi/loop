import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { VoiceTest } from "./VoiceTest";

test("microphone and local voice previews remain separate and unavailable without resources", () => {
  const html = renderToStaticMarkup(<VoiceTest disabled />);
  expect(html).toContain("Test microphone");
  expect(html).toContain("Preview voice");
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
