import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ModelChoices } from "./ModelChoices";

test("empty model catalog directs users to provider settings; provider identity disambiguates models", () => {
  const current = { provider: "first", providerName: "OpenAI", id: "same", name: "Same" };
  expect(
    renderToStaticMarkup(
      <ModelChoices models={[]} current={current} disabled={false} select={() => {}} />,
    ),
  ).toContain("Add a provider in Settings");
  const html = renderToStaticMarkup(
    <ModelChoices
      models={[current, { ...current, provider: "second" }]}
      current={current}
      disabled={true}
      select={() => {}}
    />,
  );
  expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  expect(html.match(/role="group"/g)).toHaveLength(2);
  expect(html.match(/class="model-provider-label">OpenAI</g)).toHaveLength(2);
  expect(html).not.toContain('aria-label="first"');
  expect(html).toContain("disabled");
});
