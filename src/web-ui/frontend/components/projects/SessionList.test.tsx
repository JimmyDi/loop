import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { SessionList } from "./SessionList";

test("SessionList exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionList
        sessions={[
          {
            id: "s",
            workspaceId: "p",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            messageCount: 0,
          },
        ]}
      />
    </QueryClientProvider>,
  );

  expect(html).toContain("<button");
  expect(html).toContain("2026");
  client.clear();
});
