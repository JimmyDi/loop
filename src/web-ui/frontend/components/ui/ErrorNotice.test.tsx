import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ErrorNotice } from "./ErrorNotice";

test("ErrorNotice exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ErrorNotice error={new Error("Disk full")} />
    </QueryClientProvider>,
  );

  expect(html).toContain('role="alert"');
  expect(html).toContain("Disk full");
  client.clear();
});
