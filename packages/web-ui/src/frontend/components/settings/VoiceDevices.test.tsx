import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { VoiceDevices } from "./VoiceDevices";

test("microphone selection starts with the default without requesting capture", () => {
  const html = renderToStaticMarkup(<VoiceDevices />);
  expect(html).toContain("Default microphone");
  expect(html).toContain("next call");
});
