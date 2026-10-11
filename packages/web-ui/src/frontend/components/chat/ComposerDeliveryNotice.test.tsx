import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { ComposerDeliveryNotice } from "./ComposerDeliveryNotice";

test("unconfirmed delivery uses an explicit retry button without submitting a new prompt", () => {
  const html = renderToStaticMarkup(<ComposerDeliveryNotice disabled retry={() => {}} />);
  expect(html).toContain("Check and retry same request");
  expect(html).toContain("disabled");
  expect(html).toContain('type="button"');
});
