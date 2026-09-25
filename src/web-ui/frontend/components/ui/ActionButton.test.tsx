import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ActionButton } from "./ActionButton";

test("ActionButton exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ActionButton disabled aria-label="Send">
        Send
      </ActionButton>
    </QueryClientProvider>,
  );

  expect(html).toContain("disabled");
  expect(html).toContain('aria-label="Send"');
  expect(html).toContain("Send");
  client.clear();
});
