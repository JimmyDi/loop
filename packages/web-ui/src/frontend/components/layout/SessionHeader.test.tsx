import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { SessionHeader } from "./SessionHeader";

test("SessionHeader exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionHeader />
    </QueryClientProvider>,
  );

  expect(html).toContain("New session");
  expect(html).toContain("<svg");
  expect(html).toContain("Open projects");
  expect(html).not.toContain("Rename conversation");
  expect(html).not.toContain("Regenerate title");
  expect(html).not.toContain("session-heading");
  client.clear();
});
