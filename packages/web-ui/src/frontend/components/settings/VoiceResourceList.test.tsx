import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { VoiceResourceList } from "./VoiceResourceList";

test("resource list distinguishes download, installed size and current disk use", () => {
  const html = renderToStaticMarkup(
    <VoiceResourceList
      components={[
        {
          id: "model",
          name: "Recognition model",
          kind: "asr",
          version: "1",
          license: "MIT",
          installed: false,
          downloadBytes: 1048576,
          requiredBytes: 3145728,
          installedBytes: 0,
        },
      ]}
    />,
  );
  expect(html).toContain("Download: 1 MiB");
  expect(html).toContain("Installed size: 3 MiB");
  expect(html).toContain("Currently on disk: 0 MiB");
  expect(html).toContain("License: MIT");
});
