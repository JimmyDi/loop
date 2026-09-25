import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { SessionHeader } from "./SessionHeader";

test("SessionHeader exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionHeader />
    </QueryClientProvider>,
  );

  expect(html).toContain("Loop");
  expect(html).toContain("Open projects");
  client.clear();
});
