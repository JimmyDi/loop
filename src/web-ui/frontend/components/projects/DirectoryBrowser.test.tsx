import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { DirectoryBrowser } from "./DirectoryBrowser";

test("DirectoryBrowser exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <DirectoryBrowser onSelect={() => {}} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Project directory");
  expect(html).toContain("Open path");
  expect(html).toContain("Loading");
  client.clear();
});
