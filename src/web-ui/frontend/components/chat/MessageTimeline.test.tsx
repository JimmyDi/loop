import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { MessageTimeline } from "./MessageTimeline";

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

test("MessageTimeline renders the session state without unsupported controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MessageTimeline snapshot={{ ...snapshot, operation: "idle" }} connected />
    </QueryClientProvider>,
  );

  expect(html).toContain("Ask a question");
  expect(html).toContain("message-timeline");
  client.clear();
});

test("Looping follows the latest content throughout model and tool generation", async () => {
  const draft = {
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "Partial response" }],
    api: "openai-completions" as const,
    provider: "test",
    model: "test",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop" as const,
    timestamp: 0,
  };
  const user = { role: "user" as const, content: "Example request", timestamp: 0 };
  const waiting: SessionSnapshot = {
    ...snapshot,
    state: { ...snapshot.state, messages: [user] },
  };
  const states: SessionSnapshot[] = [
    waiting,
    { ...waiting, draftIndex: 1, state: { ...waiting.state, draft } },
    {
      ...waiting,
      draftIndex: 1,
      state: {
        ...waiting.state,
        draft: { ...draft, content: [{ type: "thinking", thinking: "Considering the request" }] },
      },
    },
    {
      ...waiting,
      tools: { example: { id: "example", name: "read", status: "running" } },
    },
  ];

  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });

  try {
    for (const state of states) {
      const html = renderToStaticMarkup(<MessageTimeline snapshot={state} connected />);
      expect(html).toContain("Looping...");
      expect(html).toContain('role="status"');
      expect(html).not.toContain("Ask a question");
      expect(html.indexOf("looping-indicator")).toBeGreaterThan(html.indexOf("user-message"));
      if (state.state.draft) {
        expect(html.indexOf("looping-indicator")).toBeGreaterThan(
          html.indexOf("assistant-message"),
        );
      }
    }
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("Looping disappears after generation and during disconnection or maintenance", () => {
  for (const outcome of ["success", "cancelled", "error"] as const) {
    const html = renderToStaticMarkup(
      <MessageTimeline
        snapshot={{
          ...snapshot,
          operation: "idle",
          state: { ...snapshot.state, isRunning: false, outcome },
        }}
        connected
      />,
    );
    expect(html).not.toContain("Looping...");
  }
  for (const operation of ["model", "flush", "title"] as const) {
    const html = renderToStaticMarkup(
      <MessageTimeline snapshot={{ ...snapshot, operation }} connected />,
    );
    expect(html).not.toContain("Looping...");
  }
  expect(
    renderToStaticMarkup(<MessageTimeline snapshot={snapshot} connected={false} />),
  ).not.toContain("Looping...");
});
