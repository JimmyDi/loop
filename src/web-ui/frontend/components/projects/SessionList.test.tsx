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
  expect(html).toContain("New session");
  expect(html).not.toContain("2026");
  client.clear();
});

test("SessionList displays persisted summary titles instead of dates", () => {
  const html = renderToStaticMarkup(
    <SessionList
      sessions={[
        {
          id: "titled",
          workspaceId: "p",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          messageCount: 2,
          title: "Fix language settings",
        },
      ]}
    />,
  );
  expect(html).toContain("Fix language settings");
  expect(html).not.toContain("2026");
});
