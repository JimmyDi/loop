import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { Sidebar } from "./Sidebar";

test("Sidebar exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>,
  );

  expect(html).toContain("Projects");
  expect(html).toContain("Loop");
  expect(html).toContain("Language");
  client.clear();
});
