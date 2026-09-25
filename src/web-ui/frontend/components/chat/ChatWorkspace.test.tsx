import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ChatWorkspace } from "./ChatWorkspace";

test("ChatWorkspace exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ChatWorkspace id="example" />
    </QueryClientProvider>,
  );

  expect(html).toContain("Loading");
  expect(html).toContain("session-tabs");
  client.clear();
});
