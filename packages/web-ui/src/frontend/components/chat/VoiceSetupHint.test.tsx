import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { i18n } from "../../i18n/setup";
import { VoiceSetupHint } from "./VoiceSetupHint";

test("incomplete setup exposes the hint outside the disabled button", () => {
  const html = renderToStaticMarkup(
    <VoiceSetupHint required>
      <button type="button" disabled>
        Call
      </button>
    </VoiceSetupHint>,
  );
  expect(html).toContain(
    `<span class="voice-setup-hint" title="${i18n.t("voice.setupRequired")}">`,
  );
  expect(html).toContain('<button type="button" disabled="">Call</button></span>');
});

test("completed setup adds no wrapper or layout space", () => {
  expect(
    renderToStaticMarkup(
      <VoiceSetupHint required={false}>
        <button type="button">Call</button>
      </VoiceSetupHint>,
    ),
  ).toBe('<button type="button">Call</button>');
});
