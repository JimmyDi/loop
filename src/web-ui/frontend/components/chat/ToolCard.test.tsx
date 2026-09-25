import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ToolCard } from "./ToolCard";

test("ToolCard exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ToolCard
        tool={{
          id: "call",
          name: "read",
          status: "error",
          result: {
            role: "toolResult",
            toolCallId: "call",
            toolName: "read",
            isError: true,
            content: [{ type: "text", text: "Missing file" }],
            timestamp: 0,
          },
        }}
      />
    </QueryClientProvider>,
  );

  expect(html).toContain('data-status="error"');
  expect(html).toContain("Missing file");
  expect(html).toContain("Result");
  client.clear();
});
