import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import type { Message } from "../../../shared/protocol";
import { projectTools } from "../../../shared/tool-projection";
import { applyEvent, applyFrame } from "../../../shared/session-projection";
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
    ui.rerender(<MessageTimeline snapshot={{ ...sent, operation: "idle" }} connected={false} />);
    expect(scrollTop).toBe(800);

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
      if (state.state.draft?.content.some((part) => part.type === "thinking")) {
        expect(html).toContain("run-activity-card");
        expect(html.indexOf("looping-indicator")).toBeGreaterThan(
          html.indexOf("run-activity-card"),
        );
      }
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

test("tool rows retain order and identity across results, reconnect and historical snapshots", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const assistant: Extract<Message, { role: "assistant" }> = {
    role: "assistant",
    content: [{ type: "toolCall", id: "call", name: "bash", arguments: { command: "pwd" } }],
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
  const user: Message = { role: "user", content: "Check the project", timestamp: 0 };
  const initial: SessionSnapshot = {
    ...snapshot,
    draftIndex: 1,
    state: {
      ...snapshot.state,
      messages: [user],
      draft: assistant,
      runTimings: [{ userMessageIndex: 0, startedAt: Date.now() }],
    },
    tools: projectTools([assistant]),
  };

  try {
    const ui = render(<MessageTimeline snapshot={initial} connected />);
    expect(ui.container.querySelector(".run-activity-disclosure > summary")?.textContent).toContain(
      "Working for",
    );
    const card = ui.container.querySelector<HTMLDetailsElement>(".tool-card")!;
    card.open = true;
    let next = applyEvent(initial, { type: "message_end", message: assistant }, 1);
    next = applyEvent(next, {
      type: "tool_execution_start",
      toolCallId: "call",
      toolName: "bash",
      args: { command: "pwd" },
    });
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(card.dataset.status).toBe("running");
    expect(card.open).toBe(true);

    const result: Extract<Message, { role: "toolResult" }> = {
      role: "toolResult",
      toolCallId: "call",
      toolName: "bash",
      content: [{ type: "text", text: "Command output" }],
      isError: false,
      timestamp: 0,
    };
    next = applyEvent(next, {
      type: "tool_execution_end",
      toolCallId: "call",
      toolName: "bash",
      result,
      isError: false,
    });
    next = applyEvent(next, { type: "message_end", message: result }, 2);
    const second: typeof assistant = {
      ...assistant,
      content: [
        { type: "text", text: "The command succeeded. Read the configuration next." },
        { type: "toolCall", id: "next-call", name: "read", arguments: { path: "config.ts" } },
      ],
    };
    const secondResult: typeof result = {
      ...result,
      toolCallId: "next-call",
      toolName: "read",
      content: [{ type: "text", text: "Config contents" }],
    };
    const final: typeof assistant = {
      ...assistant,
      stopReason: "stop",
      content: [
        {
          type: "text",
          text: "Project checked.\n\n## Recommendations\n\n- Reduce subscriptions.\n- Reuse parsed Markdown.",
        },
      ],
    };
    const section = ui.container.querySelector(".run-activity-card");
    const preamble: typeof assistant = {
      ...second,
      stopReason: "stop",
      content: second.content.filter((part) => part.type === "text"),
    };
    next = applyEvent(next, { type: "message_start", message: { ...preamble, content: [] } }, 3);
    let text = "";
    for (const delta of ["The command succeeded.", " Read the configuration next."]) {
      text += delta;
      const draft = { ...preamble, content: [{ type: "text" as const, text }] };
      next = applyEvent(
        next,
        {
          type: "message_update",
          message: draft,
          assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta, partial: draft },
        },
        3,
      );
      ui.rerender(<MessageTimeline snapshot={next} connected />);
      expect(ui.container.querySelector(".assistant-avatar")).toBeNull();
      expect(ui.container.querySelector(".assistant-message")?.textContent).toContain(text);
      expect(ui.container.querySelector(".run-activity-card")).toBe(section);
      expect(section?.textContent).not.toContain(text);
      expect(ui.container.textContent).toContain("The command succeeded.");
      expect(ui.container.querySelector(".looping-indicator")).not.toBeNull();
    }

    next = applyFrame(next, {
      type: "session.snapshot",
      sessionId: "test",
      streamId: "draft-stream",
      seq: 0,
      snapshot: structuredClone(next),
    })!;
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(ui.container.querySelector(".assistant-avatar")).toBeNull();
    expect(ui.container.querySelector(".run-activity-card")).toBe(section);
    expect(ui.container.textContent).toContain("The command succeeded.");
    const pendingReconnect = render(<MessageTimeline snapshot={next} connected />);
    expect(pendingReconnect.container.querySelector(".assistant-message")?.textContent).toContain(
      "The command succeeded.",
    );
    expect(pendingReconnect.container.textContent).toContain("The command succeeded.");
    pendingReconnect.unmount();

    next = applyEvent(
      next,
      {
        type: "message_update",
        message: second,
        assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, partial: second },
      },
      3,
    );
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(ui.container.querySelectorAll(".run-activity-card")).toHaveLength(1);
    expect(ui.container.querySelectorAll(".assistant-avatar")).toHaveLength(0);
    expect(ui.container.querySelector(".assistant-message")).toBeNull();
    expect(section?.textContent).toContain("Read the configuration next.");
    const update = section?.querySelector(".execution-group-body > .activity-step:last-child");
    expect(update?.querySelector(".markdown-text")?.textContent).toContain(
      "Read the configuration next.",
    );
    expect(ui.container.textContent?.match(/Read the configuration next\./g)).toHaveLength(1);
    expect(section?.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);

    next = applyEvent(next, { type: "message_end", message: second }, 3);
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(section?.querySelector(".activity-step:last-child")).toBe(update);
    next = applyEvent(next, { type: "message_end", message: secondResult }, 4);
    next = applyEvent(next, { type: "message_start", message: { ...final, content: [] } }, 5);
    next = applyEvent(
      next,
      {
        type: "message_update",
        message: final,
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: final.content[0]!.type === "text" ? final.content[0]!.text : "",
          partial: final,
        },
      },
      5,
    );
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(ui.container.querySelector(".assistant-avatar")).toBeNull();
    expect(section?.textContent).not.toContain("Project checked.");
    const streamingAnswer = ui.container.querySelector(".assistant-message")!;
    expect(streamingAnswer.getAttribute("aria-busy")).toBe("true");
    expect(streamingAnswer.closest(".execution-group-body")).toBeNull();
    expect(ui.container.textContent).toContain("Project checked.");

    next = applyFrame(next, {
      type: "session.snapshot",
      sessionId: "test",
      streamId: "answer-stream",
      seq: 0,
      snapshot: structuredClone(next),
    })!;
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(ui.container.querySelector(".assistant-message")).toBe(streamingAnswer);
    expect(section?.textContent).not.toContain("Recommendations");
    expect(ui.container.querySelectorAll(".assistant-avatar")).toHaveLength(0);

    next = applyEvent(next, { type: "message_end", message: final }, 5);
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(ui.container.querySelector(".assistant-message")).toBe(streamingAnswer);
    next = {
      ...next,
      operation: "idle",
      state: { ...next.state, isRunning: false, outcome: "success" },
    };
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(ui.container.querySelectorAll(".assistant-avatar")).toHaveLength(0);
    const liveAnswer = ui.container.querySelector(".assistant-message")!;
    expect(liveAnswer).toBe(streamingAnswer);
    expect(liveAnswer.getAttribute("aria-busy")).toBe("false");
    expect(liveAnswer.querySelector("h2")?.textContent).toBe("Recommendations");
    expect(liveAnswer.querySelectorAll("li")).toHaveLength(2);
    expect(liveAnswer.closest(".run-activity-card")).toBeNull();
    expect(ui.container.querySelector(".assistant-message")?.textContent).toContain(
      "Project checked.",
    );
    expect(section?.textContent).not.toContain("Project checked.");
    expect(ui.container.querySelector(".run-activity-card")).toBe(section);
    const messages = [user, assistant, result, second, secondResult, final];
    const restored: SessionSnapshot = {
      ...next,
      operation: "idle",
      state: {
        ...next.state,
        messages,
        isRunning: false,
        outcome: "success",
        runTimings: [{ userMessageIndex: 0, startedAt: 1000, finishedAt: 1701000 }],
      },
      tools: projectTools(messages),
    };
    const reconnected = applyFrame(next, {
      type: "session.snapshot",
      sessionId: "test",
      streamId: "new-stream",
      seq: 0,
      snapshot: restored,
    })!;
    ui.rerender(<MessageTimeline snapshot={reconnected} connected={false} />);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);
    expect(card.dataset.status).toBe("success");
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(ui.container.querySelector(".tool-group-disclosure")).toBeNull();
    expect(ui.container.querySelectorAll(".tool-group-preamble")).toHaveLength(1);
    const assistantMessages = ui.container.querySelectorAll(".assistant-message");
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.textContent).toContain("Project checked.");
    expect(assistantMessages[0]?.querySelector(".tool-group")).toBeNull();
    expect(ui.container.querySelectorAll(".run-activity-card")).toHaveLength(1);
    const activity = ui.container.querySelector(".run-activity-card")!;
    expect(activity.querySelector("summary")?.textContent).toContain("Worked for 28m 20s");
    expect(activity.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(activity.querySelector(".assistant-avatar")).toBeNull();
    expect(activity.querySelector(".activity-step > .copy-button")).toBeNull();
    expect(activity.textContent).not.toContain("Project checked.");
    expect(activity.querySelector<HTMLDetailsElement>(".run-activity-disclosure")?.open).toBe(true);

    ui.unmount();
    const reopened = render(<MessageTimeline snapshot={restored} connected />);
    expect(
      reopened.container.querySelector(".run-activity-disclosure > summary")?.textContent,
    ).toContain("Worked for 28m 20s");
    expect(
      reopened.container.querySelector<HTMLDetailsElement>(".run-activity-disclosure")?.open,
    ).toBe(false);
    expect(reopened.container.querySelector<HTMLDetailsElement>(".tool-card")?.open).toBe(false);
    expect(reopened.container.querySelectorAll(".tool-card")).toHaveLength(2);

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: "Check another project", timestamp: 1 },
      {
        ...second,
        content: [
          { type: "text", text: "Inspect the next project" },
          { type: "toolCall", id: "third-call", name: "read", arguments: {} },
        ],
      },
    ];
    reopened.rerender(
      <MessageTimeline
        snapshot={{
          ...restored,
          operation: "prompt",
          state: {
            ...restored.state,
            messages: nextMessages,
            isRunning: true,
            outcome: "idle",
            runTimings: [
              ...restored.state.runTimings!,
              { userMessageIndex: messages.length, startedAt: Date.now() },
            ],
          },
          tools: projectTools(nextMessages),
        }}
        connected
      />,
    );
    const activities = reopened.container.querySelectorAll(".run-activity-card");
    expect(activities).toHaveLength(2);
    expect(activities[0]?.querySelector("summary")?.textContent).toContain("Worked for 28m 20s");
    expect(activities[1]?.querySelector("summary")?.textContent).toContain("Working for");
    expect(activities[0]?.textContent).not.toContain("Inspect the next project");
    expect(activities[1]?.textContent).toContain("Inspect the next project");
    expect(activities[1]?.querySelector<HTMLDetailsElement>(".run-activity-disclosure")?.open).toBe(
      true,
    );
    expect(activities[0]?.querySelector<HTMLDetailsElement>(".run-activity-disclosure")?.open).toBe(
      false,
    );
    const nextSection = activities[1]!;
    reopened.rerender(
      <MessageTimeline snapshot={{ ...restored, sessionId: "other-session" }} connected />,
    );
    expect(reopened.container.contains(nextSection)).toBe(false);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
