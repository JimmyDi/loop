import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { CopyButton } from "./CopyButton";

test("CopyButton exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <CopyButton text="hello" />
    </QueryClientProvider>,
  );

  expect(html).toContain("Copy");
  expect(html).toContain("button");
  client.clear();
});
