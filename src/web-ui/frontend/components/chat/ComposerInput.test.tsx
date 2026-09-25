import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ComposerInput } from "./ComposerInput";

test("ComposerInput exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ComposerInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        disabled
        placeholder="Message"
      />
    </QueryClientProvider>,
  );

  expect(html).toContain('role="textbox"');
  expect(html).toContain('contentEditable="false"');
  expect(html).toContain('aria-multiline="true"');
  client.clear();
});
