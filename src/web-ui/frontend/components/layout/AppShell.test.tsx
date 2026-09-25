import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { AppShell } from "./AppShell";

test("AppShell exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>,
  );

  expect(html).toContain("app-shell");
  expect(html).toContain("Resize sidebar");
  expect(html).toContain("Projects");
  client.clear();
});
