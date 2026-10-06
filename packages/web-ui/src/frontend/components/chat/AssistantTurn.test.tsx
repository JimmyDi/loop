import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";

import type { SessionSnapshot, Message } from "../../../shared/protocol";
import { applyEvent, applyFrame } from "../../../shared/session-projection";
import { projectTools } from "../../../shared/tool-projection";
import "../../i18n/setup";
import { MessageTimeline } from "./MessageTimeline";

const draft: Extract<Message, { role: "assistant" }> = {
  role: "assistant",
  content: [],
  api: "openai-completions",
  provider: "test",
  model: "test",
  stopReason: "stop",
  timestamp: 0,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
};

const initial: SessionSnapshot = {
  streamId: "stream",
  sessionId: "example",
  workspaceId: "project",
  model: { id: "test", provider: "test", name: "Test" },
  operation: "prompt",
  tools: {},
  state: {
    messages: [{ role: "user", content: "Check files", timestamp: 0 }],
    isRunning: true,
    outcome: "idle",
    hasPendingSave: false,
    listenerErrors: [],
  },
};

test("phase text, multiple tool batches and final replies stay flat through streaming and reconnect", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act, waitFor } = await import("@testing-library/react/pure");
  try {
    let snapshot = applyEvent(initial, {
      type: "prompt_timing",
      timing: { userMessageIndex: 0, startedAt: Date.now() },
    });
    snapshot = applyEvent(snapshot, { type: "message_start", message: draft }, 1);
    const ui = render(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".user-message")?.nextElementSibling?.className).toBe(
      "prompt-duration",
    );
    expect(ui.container.textContent).toContain("Working for 0s");
    let phaseText = "";
    let phaseNode: Element | null = null;
    for (const delta of ["Inspect the", " configuration and references."]) {
      phaseText += delta;
      const message: typeof draft = { ...draft, content: [{ type: "text", text: phaseText }] };
      snapshot = applyEvent(
        snapshot,
        {
          type: "message_update",
          message,
          assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta, partial: message },
        },
        1,
      );
      ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
      phaseNode ??= ui.container.querySelector(".markdown-text");
      expect(ui.container.querySelector(".markdown-text")).toBe(phaseNode);
      expect(phaseNode?.textContent).toContain(phaseText);
      expect(ui.container.querySelector(".run-activity-card")).toBeNull();
    }
    const batch: typeof draft = {
      ...draft,
      stopReason: "toolUse",
      content: [
        { type: "text", text: phaseText },
        { type: "thinking", thinking: "Hidden thinking" },
        { type: "toolCall", id: "read", name: "read", arguments: { path: "config.ts" } },
        { type: "toolCall", id: "bash", name: "bash", arguments: { command: "pnpm test" } },
      ],
    };
    snapshot = applyEvent(
      snapshot,
      {
        type: "message_update",
        message: batch,
        assistantMessageEvent: { type: "toolcall_start", contentIndex: 2, partial: batch },
      },
      1,
    );
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".markdown-text")).toBe(phaseNode);
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(ui.container.querySelector(".tool-group-label")?.textContent).toBe("Run pnpm test");
    expect(ui.container.textContent).not.toContain("Hidden thinking");
    const disclosure = ui.container.querySelector<HTMLDetailsElement>(".tool-group")!;
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    const card = ui.container.querySelector<HTMLDetailsElement>(".tool-card")!;
    card.open = true;
    snapshot = applyEvent(snapshot, { type: "message_end", message: batch }, 1);
    snapshot = applyEvent(snapshot, {
      type: "tool_execution_start",
      toolCallId: "read",
      toolName: "read",
      args: { path: "config.ts" },
    });
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(card.dataset.status).toBe("running");

    const result: Extract<Message, { role: "toolResult" }> = {
      role: "toolResult",
      toolCallId: "read",
      toolName: "read",
      content: [{ type: "text", text: "Configuration contents" }],
      isError: false,
      timestamp: 0,
    };
    snapshot = applyEvent(snapshot, {
      type: "tool_execution_end",
      toolCallId: "read",
      toolName: "read",
      result,
      isError: false,
    });
    snapshot = applyEvent(snapshot, { type: "message_end", message: result }, 2);
    const failed = {
      ...result,
      toolCallId: "bash",
      toolName: "bash",
      isError: true,
      content: [{ type: "text" as const, text: "Test failed" }],
    };
    snapshot = applyEvent(snapshot, { type: "message_end", message: failed }, 3);
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(card.open).toBe(true);
    expect(card.textContent).toContain("Configuration contents");
    expect(disclosure.open).toBe(true);
    expect(disclosure.dataset.active).toBe("false");
    expect(disclosure.querySelector(".tool-group-label")?.textContent).toBe(
      "Read 1 file and 1 tool failed",
    );
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
    await waitFor(() =>
      expect(card.querySelector(".tool-status-icon")?.getAttribute("data-status")).toBe("success"),
    );

    const continuation: typeof draft = {
      ...draft,
      stopReason: "toolUse",
      content: [
        { type: "toolCall", id: "references", name: "read", arguments: { path: "references.ts" } },
      ],
    };
    snapshot = applyEvent(snapshot, { type: "message_end", message: continuation }, 4);
    const nextResult = { ...result, toolCallId: "references" };
    snapshot = applyEvent(snapshot, { type: "message_end", message: nextResult }, 5);
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".markdown-text")).toBe(phaseNode);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(3);
    expect(
      ui.container.textContent?.match(/Inspect the configuration and references\./g),
    ).toHaveLength(1);

    snapshot = applyFrame(snapshot, {
      type: "session.snapshot",
      sessionId: "example",
      streamId: "reconnected",
      seq: 0,
      snapshot: structuredClone(snapshot),
    })!;
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);
    expect(disclosure.open).toBe(true);
    let answerText = "";
    let answerNode: Element | null = null;
    let final = draft;
    for (const delta of ["Configuration checked.", " The related tests failed."]) {
      answerText += delta;
      final = {
        ...draft,
        content: [
          {
            type: "text",
            text: answerText,
            textSignature: JSON.stringify({ v: 1, id: "reply", phase: "final_answer" }),
          },
        ],
      };
      snapshot = applyEvent(
        snapshot,
        {
          type: "message_update",
          message: final,
          assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta, partial: final },
        },
        6,
      );
      ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
      answerNode ??= ui.container.querySelectorAll(".markdown-text")[1]!;
      expect(ui.container.querySelectorAll(".markdown-text")[1]).toBe(answerNode);
      expect(answerNode.textContent).toContain(answerText);
      expect(ui.container.querySelector(".looping-indicator")).not.toBeNull();
      expect(ui.container.querySelector(".tool-card")).toBe(card);
      expect(disclosure.dataset.active).toBe("false");
    }
    snapshot = applyEvent(snapshot, { type: "message_end", message: final }, 6);
    snapshot = applyEvent(snapshot, {
      type: "prompt_timing",
      timing: { userMessageIndex: 0, startedAt: 1000, finishedAt: 30000 },
    });
    snapshot = {
      ...snapshot,
      operation: "idle",
      state: { ...snapshot.state, isRunning: false, outcome: "success" },
    };
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelectorAll(".markdown-text")[1]).toBe(answerNode);
    expect(card.open).toBe(true);
    expect(ui.container.querySelector(".looping-indicator")).toBeNull();
    expect(ui.container.querySelector(".prompt-duration")?.textContent).toBe("Worked for 29s");
    expect(answerNode?.closest(".assistant-message")?.firstElementChild?.className).toBe(
      "prompt-duration",
    );
    expect(ui.container.textContent).not.toContain("Working for");
    expect(ui.container.querySelectorAll(".assistant-message .message-footer")).toHaveLength(1);
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(3);
    ui.unmount();
    const history = render(<MessageTimeline snapshot={structuredClone(snapshot)} connected />);
    expect(history.container.querySelectorAll(".tool-card")).toHaveLength(3);
    expect(history.container.querySelector<HTMLDetailsElement>(".tool-card")?.open).toBe(false);
    expect(history.container.querySelector<HTMLDetailsElement>(".tool-group")?.open).toBe(false);
    expect(history.container.querySelector(".run-activity-card")).toBeNull();
    expect(history.container.textContent).toContain(phaseText);
    expect(history.container.textContent).toContain(answerText);
    expect(history.container.querySelectorAll(".prompt-duration")).toHaveLength(1);
    expect(history.container.textContent).toContain("Worked for 29s");
  } finally {
    try {
      await act(async () => {
        cleanup();
        await new Promise<void>((resolve) => setImmediate(resolve));
      });
      await window.happyDOM.close();
    } finally {
      Object.assign(globalThis, previous);
    }
  }
});

test("native commentary and final text retain content order while thinking stays hidden", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  try {
    const message: typeof draft = {
      ...draft,
      content: [
        {
          type: "text",
          text: "Inspect configuration.",
          textSignature: JSON.stringify({ v: 1, id: "update", phase: "commentary" }),
        },
        { type: "thinking", thinking: "Hidden thinking" },
        { type: "toolCall", id: "call", name: "read", arguments: { path: "config.ts" } },
        { type: "text", text: "Then check references." },
      ],
    };
    const html = renderToStaticMarkup(
      <MessageTimeline
        snapshot={{
          ...initial,
          draftIndex: 1,
          tools: projectTools([message]),
          state: { ...initial.state, draft: message },
        }}
        connected
      />,
    );
    expect(html.indexOf("Inspect configuration.")).toBeLessThan(html.indexOf("Read config.ts"));
    expect(html.indexOf("Read config.ts")).toBeLessThan(html.indexOf("Then check references."));
    expect(html).not.toContain("Hidden thinking");
    expect(html).not.toContain("assistant-content-label");
    expect(html).not.toContain("assistant · message #");
    expect(html).not.toContain("execution-group");
    expect(html).not.toContain("tool-call-description");
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("tool-only turns and standalone results do not invent replies, and partial failures stay visible", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  try {
    for (const stopReason of ["error", "aborted", "length"] as const) {
      const message = {
        ...draft,
        stopReason,
        errorMessage: "Response interrupted",
        content: [{ type: "text" as const, text: "Partial response" }],
      };
      const html = renderToStaticMarkup(
        <MessageTimeline
          snapshot={{
            ...initial,
            operation: "idle",
            state: {
              ...initial.state,
              isRunning: false,
              messages: [...initial.state.messages, message],
            },
          }}
          connected
        />,
      );
      expect(html).toContain("Partial response");
      expect(html).toContain("Response interrupted");
      expect(html).toContain('role="alert"');
    }
    const orphan: Message = {
      role: "toolResult",
      toolCallId: "orphan",
      toolName: "read",
      content: [{ type: "text", text: "Operation cancelled" }],
      isError: true,
      timestamp: 0,
    };
    const toolOnly = {
      ...draft,
      stopReason: "toolUse" as const,
      content: [{ type: "toolCall" as const, id: "call", name: "read", arguments: {} }],
    };
    const error = { ...draft, stopReason: "error" as const, errorMessage: "Connection failed" };
    const messages = [...initial.state.messages, toolOnly, orphan, error];
    const html = renderToStaticMarkup(
      <MessageTimeline
        snapshot={{
          ...initial,
          operation: "idle",
          tools: projectTools(messages),
          state: { ...initial.state, messages, isRunning: false },
        }}
        connected
      />,
    );
    expect(html.match(/class="tool-card"/g)).toHaveLength(2);
    expect(html).toContain("Operation cancelled");
    expect(html).toContain("Connection failed");
    expect(html).not.toContain("Copy response");
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
