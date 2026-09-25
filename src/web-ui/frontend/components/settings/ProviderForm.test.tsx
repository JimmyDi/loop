import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import "../../i18n/setup";
import { ProviderForm } from "./ProviderForm";

test("provider form exposes URL/model/authentication with a default GPT-5.5 model", () => {
  const html = renderToStaticMarkup(
    <ProviderForm initial={null} save={async () => {}} onClose={() => {}} />,
  );

  for (const text of [
    "Provider name",
    "Base URL",
    "Model ID",
    "gpt-5.5",
    "API key",
    "No authentication",
    'type="password"',
  ])
    expect(html).toContain(text);
});
