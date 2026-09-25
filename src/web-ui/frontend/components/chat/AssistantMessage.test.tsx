import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Message } from "../../../shared/protocol";
import "../../i18n/setup";
import { AssistantMessage } from "./AssistantMessage";

test("AssistantMessage renders the session state without unsupported controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AssistantMessage
        message={
          {
            role: "assistant",
            content: [{ type: "thinking", thinking: "Actual thinking" }],
          } as Extract<Message, { role: "assistant" }>
        }
        tools={{}}
        streaming
      />
    </QueryClientProvider>,
  );

  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("Actual thinking");
  client.clear();
});

test("restored empty error messages retain their failure instead of an empty copy button", () => {
  const html = renderToStaticMarkup(
    <AssistantMessage
      message={{
        role: "assistant",
        content: [],
        stopReason: "error",
        errorMessage: "Connection error.",
        api: "openai-completions",
        provider: "test",
        model: "test",
        timestamp: 0,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      }}
      tools={{}}
    />,
  );

  expect(html).toContain("Connection error.");
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("copy-button");
});
