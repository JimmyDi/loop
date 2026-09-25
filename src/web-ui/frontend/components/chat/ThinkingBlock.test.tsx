import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ThinkingBlock } from "./ThinkingBlock";

test("ThinkingBlock exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ThinkingBlock text="Reasoning from the model" />
    </QueryClientProvider>,
  );

  expect(html).toContain("<details");
  expect(html).toContain("Thinking");
  expect(html).toContain("Reasoning from the model");
  client.clear();
});
