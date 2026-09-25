import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { SessionStatus } from "./SessionStatus";

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

test("SessionStatus renders the session state without unsupported controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionStatus
        snapshot={{
          ...snapshot,
          operation: "idle",
          state: { ...snapshot.state, hasPendingSave: true },
        }}
        connected
      />
    </QueryClientProvider>,
  );

  expect(html).toContain("unsaved changes");
  expect(html).toContain("Retry save");
  client.clear();
});

test("a pending model request explains the wait before the first streamed message", () => {
  const html = renderToStaticMarkup(<SessionStatus snapshot={snapshot} connected />);

  expect(html).toContain("Waiting for the model to respond");
  expect(html).toContain("stop this request");
});

test("a failed model connection leaves the running state and shows configuration guidance", () => {
  const html = renderToStaticMarkup(
    <SessionStatus
      snapshot={{
        ...snapshot,
        operation: "idle",
        state: {
          ...snapshot.state,
          isRunning: false,
          outcome: "error",
          error: "Connection error.",
        },
      }}
      connected
    />,
  );

  expect(html).toContain("Connection error.");
  expect(html).toContain("Open Model settings");
  expect(html).not.toContain("Waiting for the model");
});
