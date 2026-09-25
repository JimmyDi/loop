import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { Welcome } from "./Welcome";

test("Welcome exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Welcome />
    </QueryClientProvider>,
  );

  expect(html).toContain("What would you like to build?");
  expect(html).toContain("Choose a project");
  client.clear();
});
