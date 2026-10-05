import { expect, test } from "vitest";
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

test("routine session states leave no status row above the input", () => {
  for (const outcome of ["idle", "success", "cancelled"] as const) {
    const html = renderToStaticMarkup(
      <SessionStatus
        snapshot={{
          ...snapshot,
          operation: "idle",
          state: { ...snapshot.state, isRunning: false, outcome },
        }}
        connected
      />,
    );
    expect(html).toBe("");
  }
  expect(renderToStaticMarkup(<SessionStatus snapshot={snapshot} connected />)).toBe("");
});

test("connection loss still explains why the composer is unavailable", () => {
  const html = renderToStaticMarkup(<SessionStatus snapshot={snapshot} connected={false} />);

  expect(html).toContain("Reconnecting");
  expect(html).not.toContain("Looping...");
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
  expect(html).toContain('aria-label="Close"');
  expect(html).toContain("Open Settings → Models");
  expect(html).not.toContain("Looping...");
});
