import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { UserMessage } from "./UserMessage";

test("UserMessage exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <UserMessage message={{ role: "user", content: "<script>text</script>", timestamp: 0 }} />
    </QueryClientProvider>,
  );

  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Copy");
  client.clear();
});
