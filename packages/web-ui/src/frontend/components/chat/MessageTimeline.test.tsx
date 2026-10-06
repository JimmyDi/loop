import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import type { Message } from "../../../shared/protocol";
import { projectTools } from "../../../shared/tool-projection";
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

test("sending aligns the actual user message and keeps it steady through snapshot updates", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  let userTop = 800;
  let contentHeight = 950;
  let scrollTop = 0;
  const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const bounds = originalRect.call(this);
    if (this.classList.contains("user-message")) bounds.y = userTop - scrollTop;
    if (this.classList.contains("timeline-content")) {
      bounds.y = -scrollTop;
      bounds.height = Math.max(contentHeight, Number.parseFloat(this.style.minHeight) || 0);
    }
    if (
      this.parentElement?.classList.contains("timeline-content") &&
      this.getAttribute("aria-hidden") === "true"
    )
      bounds.y = contentHeight - scrollTop;
    return bounds;
  };

  try {
    const ui = render(<MessageTimeline snapshot={{ ...snapshot, operation: "idle" }} connected />);
    const timeline = ui.container.querySelector<HTMLDivElement>(".message-timeline")!;
    const content = ui.container.querySelector<HTMLDivElement>(".timeline-content")!;
    Object.defineProperties(timeline, {
      clientHeight: { value: 500 },
      scrollHeight: {
        get: () => Math.max(contentHeight, Number.parseFloat(content.style.minHeight) || 0),
      },
      scrollTop: {
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = Math.max(0, Math.min(value, timeline.scrollHeight - 500));
        },
      },
    });
    const sent: SessionSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        messages: [{ role: "user", content: "Example request", timestamp: 0 }],
      },
    };
    ui.rerender(<MessageTimeline snapshot={sent} connected />);
    expect(scrollTop).toBe(800);
    expect(ui.container.querySelector(".user-message")?.getBoundingClientRect().top).toBe(0);
    fireEvent.scroll(timeline);
    contentHeight = 1900;
    ui.rerender(<MessageTimeline snapshot={structuredClone(sent)} connected />);
    expect(scrollTop).toBe(800);
    expect(ui.container.querySelector(".jump-latest")).not.toBeNull();
    expect(ui.container.querySelector(".jump-latest-dots")).not.toBeNull();
    ui.rerender(<MessageTimeline snapshot={sent} connected={false} />);
    expect(ui.container.querySelector(".jump-latest")).not.toBeNull();
    expect(ui.container.querySelector(".jump-latest-dots")).toBeNull();
    ui.rerender(<MessageTimeline snapshot={sent} connected />);
    expect(ui.container.querySelector(".jump-latest-dots")).not.toBeNull();
    ui.rerender(<MessageTimeline snapshot={{ ...sent, operation: "idle" }} connected={false} />);
    expect(scrollTop).toBe(800);
    expect(ui.container.querySelector(".jump-latest-dots")).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Jump to latest" }));
    expect(scrollTop).toBe(1400);
    expect(ui.container.querySelector(".jump-latest")).toBeNull();

    userTop = 1900;
    contentHeight = 2050;
    ui.rerender(
      <MessageTimeline
        snapshot={{
          ...sent,
          state: {
            ...sent.state,
            messages: [...sent.state.messages, { role: "user", content: [], timestamp: 1 }],
          },
        }}
        connected
      />,
    );
    expect(scrollTop).toBe(1900);
    expect(ui.container.querySelectorAll(".user-message")).toHaveLength(2);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
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
      expect(html).not.toContain("run-activity-card");
      expect(html).not.toContain("Considering the request");
      if (state.state.draft?.content.some((part) => part.type === "text")) {
        expect(html).toContain("assistant-message");
        expect(html).not.toContain("run-activity-card");
        expect(html).toContain("Partial response");
      } else expect(html).not.toContain("assistant-message");
      expect(html).not.toContain("assistant-avatar");
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

test("reopened history shows phase updates, tools and final replies without execution disclosures", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  try {
    const assistant: Extract<Message, { role: "assistant" }> = {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Hidden thinking" },
        { type: "text", text: "Inspect configuration before editing." },
        { type: "toolCall", id: "read", name: "read", arguments: { path: "config.ts" } },
      ],
      api: "openai-completions",
      provider: "test",
      model: "test",
      timestamp: 0,
      stopReason: "toolUse",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    };
    const result: Message = {
      role: "toolResult",
      toolCallId: "read",
      toolName: "read",
      content: [{ type: "text", text: "Configuration contents" }],
      isError: false,
      timestamp: 0,
    };
    const messages: Message[] = [
      { role: "user", content: "Check configuration", timestamp: 0 },
      assistant,
      result,
      {
        ...assistant,
        content: [{ type: "text", text: "Configuration checked." }],
        stopReason: "stop",
      },
      { role: "user", content: "Next request", timestamp: 0 },
      { ...assistant, content: [{ type: "text", text: "Next answer." }], stopReason: "stop" },
    ];
    const html = renderToStaticMarkup(
      <MessageTimeline
        snapshot={{
          ...snapshot,
          operation: "idle",
          tools: projectTools(messages),
          state: {
            ...snapshot.state,
            messages,
            isRunning: false,
            outcome: "success",
          },
        }}
        connected
      />,
    );
    expect(html).not.toContain("Hidden thinking");
    expect(html).not.toContain("run-activity");
    expect(html).not.toContain("execution-group");
    expect(html).not.toContain("Worked for");
    expect(html.match(/class="tool-card"/g)).toHaveLength(1);
    expect(html).toContain("Read 1 file");
    expect(html.indexOf("Inspect configuration before editing.")).toBeLessThan(
      html.indexOf("Read config.ts"),
    );
    expect(html.indexOf("Read config.ts")).toBeLessThan(html.indexOf("Configuration checked."));
    expect(html.indexOf("Configuration checked.")).toBeLessThan(html.indexOf("Next request"));
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
