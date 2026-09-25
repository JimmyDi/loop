import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { SessionTabs } from "./SessionTabs";

test("SessionTabs exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionTabs />
    </QueryClientProvider>,
  );

  expect(html).toContain("session-tabs");
  expect(html).toContain("<nav");
  client.clear();
});
