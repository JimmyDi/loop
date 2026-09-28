import { expect, test } from "bun:test";
import { createInstance } from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";

import { LoopingIndicator } from "./LoopingIndicator";

test("generation label stays readable when cached translations lack the new key", async () => {
  const i18n = createInstance();
  await i18n.init({
    lng: "zh",
    fallbackLng: "en",
    resources: { en: { translation: {} }, zh: { translation: {} } },
    initAsync: false,
  });

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <LoopingIndicator />
    </I18nextProvider>,
  );

  expect(html).toContain(">Looping...</span>");
  expect(html).not.toContain(">looping</span>");
});
