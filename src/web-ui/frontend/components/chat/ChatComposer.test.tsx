import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { ChatComposer } from "./ChatComposer";

const snapshot: SessionSnapshot = {
  streamId: "stream",
  sessionId: "test",
  workspaceId: "project",
  model: { id: "test", name: "Test", provider: "test" },
  operation: "prompt",
  tools: {},
  state: {
    messages: [],
    isRunning: true,
    hasPendingSave: false,
    outcome: "idle",
    listenerErrors: [],
  },
};

test("ChatComposer renders the session state without unsupported controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ChatComposer snapshot={snapshot} connected={true} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Stop generating");
  expect(html).toContain('aria-disabled="true"');
  client.clear();
});
