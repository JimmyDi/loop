import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { SessionSnapshot, Message } from "../../../shared/protocol";
import { applyEvent, applyFrame } from "../../../shared/session-projection";
import "../../i18n/setup";
import { MessageTimeline } from "./MessageTimeline";

test("native commentary stays in reasoning and the answer streams outside it before settlement", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, waitFor } = await import("@testing-library/react/pure");
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
  let snapshot: SessionSnapshot = {
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
  try {
    const ui = render(<MessageTimeline snapshot={snapshot} connected />);
    let raw = "";
    let message = draft;
    let section: Element | null = null;
    let textNode: Element | null = null;
    for (const delta of ["Inspect", " the configuration."]) {
      raw += delta;
      message = {
        ...draft,
        content: [
          {
            type: "text",
            text: raw,
            textSignature: JSON.stringify({ v: 1, id: "update", phase: "commentary" }),
          },
        ],
      };
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
      expect(ui.container.querySelector(".assistant-message")).toBeNull();
      expect(ui.container.textContent).not.toContain("loop:");
      if (raw) {
        section ??= ui.container.querySelector(".run-activity-card");
        textNode ??= section!.querySelector(".activity-step .markdown-text");
        expect(ui.container.querySelector(".run-activity-card")).toBe(section);
        expect(section!.querySelector(".markdown-text")).toBe(textNode);
        expect(textNode?.textContent).toContain(raw);
      }
    }
    message = {
      ...message,
      content: [
        ...message.content,
        { type: "toolCall", id: "call", name: "bash", arguments: { command: "pwd" } },
      ],
    };
    snapshot = applyEvent(
      snapshot,
      {
        type: "message_update",
        message,
        assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, partial: message },
      },
      1,
    );
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    const card = ui.container.querySelector<HTMLDetailsElement>(".tool-card")!;
    expect(card.dataset.status).toBe("waiting");
    expect(section!.querySelector(".markdown-text")).toBe(textNode);
    snapshot = applyEvent(
      snapshot,
      { type: "message_end", message: { ...message, stopReason: "toolUse" } },
      1,
    );
    const running = applyEvent(snapshot, {
      type: "tool_execution_start",
      toolCallId: "call",
      toolName: "bash",
      args: { command: "pwd" },
    });
    ui.rerender(<MessageTimeline snapshot={running} connected />);
    expect(card.dataset.status).toBe("running");
    expect(card.querySelector(".activity-status-icon")?.getAttribute("aria-label")).toBe("Running");
    expect(card.querySelector(".activity-status-icon path")?.getAttribute("d")).toBe(
      "M12 3a9 9 0 1 1-9 9",
    );
    expect(card.querySelector(".activity-status-icon circle")).toBeNull();
    expect(card.textContent).not.toContain("Result");
    card.open = true;
    const reconnected = applyFrame(running, {
      type: "session.snapshot",
      sessionId: "example",
      streamId: "new",
      seq: 0,
      snapshot: structuredClone(running),
    })!;
    ui.rerender(<MessageTimeline snapshot={reconnected} connected />);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);
    expect(card.dataset.status).toBe("running");
    for (const isError of [false, true]) {
      const result: Extract<Message, { role: "toolResult" }> = {
        role: "toolResult",
        toolCallId: "call",
        toolName: "bash",
        content: [{ type: "text", text: "Example result" }],
        isError,
        timestamp: 0,
      };
      snapshot = applyEvent(running, {
        type: "tool_execution_end",
        toolCallId: "call",
        toolName: "bash",
        result,
        isError,
      });
      snapshot = applyEvent(snapshot, { type: "message_end", message: result }, 2);
      ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
      expect(ui.container.querySelector(".tool-card")).toBe(card);
      expect(card.dataset.status).toBe(isError ? "error" : "success");
      await waitFor(() =>
        expect(card.querySelector(".activity-status-icon path")?.getAttribute("d")).toBe(
          isError ? "m9 9 6 6m0-6-6 6" : "m8 12 3 3 5-6",
        ),
      );
      expect(card.open).toBe(true);
    }
    let final = {
      ...draft,
      content: [{ type: "text" as const, text: "Configuration checked." }],
    };
    snapshot = applyEvent(
      snapshot,
      {
        type: "message_update",
        message: final,
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: final.content[0]!.text,
          partial: final,
        },
      },
      3,
    );
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    const answer = ui.container.querySelector(".assistant-message")!;
    expect(answer.textContent).toContain("Configuration checked.");
    expect(answer.closest(".run-activity-card")).toBeNull();
    expect(answer.getAttribute("aria-busy")).toBe("true");
    expect(section?.textContent).not.toContain("Configuration checked.");
    expect(ui.container.querySelector(".assistant-avatar")).toBeNull();
    const markdown = answer.querySelector(".markdown-text");
    for (const delta of [
      "\n\n## Responsibilities\n\n",
      ...Array.from({ length: 8 }, (_, index) => `- Component ${index + 1} is documented.\n`),
    ]) {
      final = { ...final, content: [{ type: "text", text: final.content[0]!.text + delta }] };
      snapshot = applyEvent(
        snapshot,
        {
          type: "message_update",
          message: final,
          assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta, partial: final },
        },
        3,
      );
      ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
      expect(ui.container.querySelector(".assistant-message")).toBe(answer);
      expect(answer.querySelector(".markdown-text")).toBe(markdown);
      expect(answer.closest(".execution-group-body")).toBeNull();
      expect(section?.textContent).not.toContain("Responsibilities");
      expect(ui.container.querySelector(".tool-card")).toBe(card);
    }
    expect(answer.querySelectorAll("li")).toHaveLength(8);
    snapshot = applyFrame(snapshot, {
      type: "session.snapshot",
      sessionId: "example",
      streamId: "reply-reconnect",
      seq: 0,
      snapshot: structuredClone(snapshot),
    })!;
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".assistant-message")).toBe(answer);
    expect(
      section!
        .querySelector(".execution-group > details > summary > svg")
        ?.getAttribute("data-status"),
    ).toBe("success");
    snapshot = applyEvent(snapshot, { type: "message_end", message: final }, 3);
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".assistant-message")).toBe(answer);
    snapshot = {
      ...snapshot,
      operation: "idle",
      state: { ...snapshot.state, isRunning: false, outcome: "success" },
    };
    ui.rerender(<MessageTimeline snapshot={snapshot} connected />);
    expect(ui.container.querySelector(".assistant-message")).toBe(answer);
    expect(answer.getAttribute("aria-busy")).toBe("false");
    expect(ui.container.querySelector(".assistant-message")?.textContent).toContain(
      "Configuration checked.",
    );
    expect(section?.textContent).not.toContain("Configuration checked.");
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);
    expect(section?.querySelector<HTMLDetailsElement>(".run-activity-disclosure")?.open).toBe(true);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("unclassified text stays visible outside reasoning until a call arrives, including reconnect", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
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
      messages: [{ role: "user", content: "Check the project", timestamp: 0 }],
      isRunning: true,
      outcome: "idle",
      hasPendingSave: false,
      listenerErrors: [],
    },
  };
  try {
    let next = applyEvent(initial, { type: "message_start", message: draft }, 1);
    const ui = render(<MessageTimeline snapshot={next} connected />);
    let text = "";
    for (const delta of ["Inspect the", " configuration first."]) {
      text += delta;
      const message = { ...draft, content: [{ type: "text" as const, text }] };
      next = applyEvent(
        next,
        {
          type: "message_update",
          message,
          assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta, partial: message },
        },
        1,
      );
      ui.rerender(<MessageTimeline snapshot={next} connected />);
      expect(ui.container.querySelector(".assistant-message")?.textContent).toContain(text);
      expect(ui.container.querySelector(".run-activity-card")).toBeNull();
      expect(ui.container.textContent).toContain(text);
      expect(ui.container.querySelector(".looping-indicator")).not.toBeNull();
    }
    next = applyFrame(next, {
      type: "session.snapshot",
      sessionId: "example",
      streamId: "reconnected",
      seq: 0,
      snapshot: structuredClone(next),
    })!;
    ui.unmount();
    const restored = render(<MessageTimeline snapshot={next} connected />);
    expect(restored.container.querySelector(".assistant-message")?.textContent).toContain(text);
    expect(restored.container.textContent).toContain(text);
    const pending = next;
    const tool: typeof draft = {
      ...draft,
      content: [
        { type: "text", text },
        { type: "toolCall", id: "first", name: "bash", arguments: {} },
      ],
    };
    next = applyEvent(
      next,
      {
        type: "message_update",
        message: tool,
        assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, partial: tool },
      },
      1,
    );
    restored.rerender(<MessageTimeline snapshot={next} connected />);
    const section = restored.container.querySelector(".run-activity-card")!;
    const preamble = section.querySelector(".execution-group-body > .activity-step .markdown-text");
    expect(preamble?.textContent?.trim()).toBe(text);
    expect(section.querySelector(".tool-card")).not.toBeNull();
    expect(restored.container.querySelector(".assistant-message")).toBeNull();
    expect(restored.container.querySelector(".assistant-avatar")).toBeNull();
    next = applyEvent(
      next,
      { type: "message_end", message: { ...tool, stopReason: "toolUse" } },
      1,
    );
    restored.rerender(<MessageTimeline snapshot={next} connected />);
    expect(restored.container.querySelector(".run-activity-card")).toBe(section);
    expect(section.querySelector(".markdown-text")).toBe(preamble);
    expect(
      restored.container.textContent?.match(/Inspect the configuration first\./g),
    ).toHaveLength(1);

    // Direct answers and partial failures stay outside reasoning after settlement.
    for (const stopReason of ["stop", "error", "aborted"] as const) {
      const message = {
        ...pending.state.draft!,
        stopReason,
        errorMessage: stopReason === "stop" ? undefined : "Stopped",
      };
      const settled = applyEvent(pending, { type: "message_end", message }, 1);
      const finished: SessionSnapshot = {
        ...settled,
        operation: "idle",
        state: {
          ...settled.state,
          isRunning: false,
          outcome:
            stopReason === "stop" ? "success" : stopReason === "aborted" ? "cancelled" : "error",
        },
      };
      restored.rerender(<MessageTimeline snapshot={finished} connected />);
      expect(restored.container.querySelector(".run-activity-card")).toBeNull();
      expect(restored.container.querySelector(".assistant-message")?.textContent).toContain(text);
      expect(restored.container.querySelectorAll(".assistant-avatar")).toHaveLength(1);
      if (message.errorMessage) expect(restored.container.textContent).toContain("Stopped");
    }
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("reasoning shows completion before body output while the overall run stays active", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const thought = { type: "thinking" as const, thinking: "Check the result" };
  const draft: Extract<Message, { role: "assistant" }> = {
    role: "assistant",
    content: [thought],
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
      messages: [{ role: "user", content: "Check the project", timestamp: 0 }],
      isRunning: true,
      outcome: "idle",
      hasPendingSave: false,
      listenerErrors: [],
      runTimings: [{ userMessageIndex: 0, startedAt: Date.now() }],
    },
  };
  try {
    let next = applyEvent(
      initial,
      {
        type: "message_update",
        message: draft,
        assistantMessageEvent: {
          type: "thinking_delta",
          contentIndex: 0,
          delta: thought.thinking,
          partial: draft,
        },
      },
      1,
    );
    const ui = render(<MessageTimeline snapshot={next} connected />);
    const icon = () =>
      ui.container.querySelector(".execution-group > details > summary > .activity-status-icon");
    const section = ui.container.querySelector(".run-activity-disclosure");
    expect(icon()?.getAttribute("data-status")).toBe("running");

    next = applyEvent(
      next,
      {
        type: "message_update",
        message: draft,
        assistantMessageEvent: {
          type: "thinking_end",
          contentIndex: 0,
          content: thought.thinking,
          partial: draft,
        },
      },
      1,
    );
    ui.rerender(<MessageTimeline snapshot={next} connected />);
    expect(icon()?.getAttribute("data-status")).toBe("success");
    expect(ui.container.querySelector(".assistant-message")).toBeNull();
    expect(ui.container.querySelector(".run-activity-disclosure")).toBe(section);
    expect(section?.textContent).toContain("Working for");
    expect(ui.container.querySelector(".looping-indicator")).not.toBeNull();

    const reconnected = applyFrame(next, {
      type: "session.snapshot",
      sessionId: "example",
      streamId: "reconnected",
      seq: 0,
      snapshot: next,
    })!;
    ui.unmount();
    const restored = render(<MessageTimeline snapshot={reconnected} connected />);
    expect(
      restored.container
        .querySelector(".execution-group .activity-status-icon")
        ?.getAttribute("data-status"),
    ).toBe("success");

    const body = {
      ...draft,
      content: [thought, { type: "text" as const, text: "Partial answer" }],
    };
    next = applyEvent(
      next,
      {
        type: "message_update",
        message: body,
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 1,
          delta: "Partial answer",
          partial: body,
        },
      },
      1,
    );
    restored.rerender(<MessageTimeline snapshot={next} connected />);
    expect(
      restored.container
        .querySelector(".execution-group .activity-status-icon")
        ?.getAttribute("data-status"),
    ).toBe("success");
    expect(restored.container.querySelector(".assistant-message")?.textContent).toContain(
      "Partial answer",
    );
    expect(restored.container.querySelector(".run-activity-card")?.textContent).not.toContain(
      "Partial answer",
    );
    expect(restored.container.querySelector(".assistant-avatar")).toBeNull();

    const tool = {
      ...body,
      content: [
        ...body.content,
        { type: "toolCall" as const, id: "call", name: "read", arguments: {} },
      ],
    };
    next = applyEvent(
      next,
      {
        type: "message_update",
        message: tool,
        assistantMessageEvent: { type: "toolcall_start", contentIndex: 2, partial: tool },
      },
      1,
    );
    restored.rerender(<MessageTimeline snapshot={next} connected />);
    expect(
      restored.container
        .querySelector(".execution-group .activity-status-icon")
        ?.getAttribute("data-status"),
    ).toBe("running");
    expect(restored.container.querySelector(".assistant-message")).toBeNull();
    expect(restored.container.querySelector(".run-activity-card")?.textContent).toContain(
      "Partial answer",
    );
    expect(restored.container.querySelector(".assistant-avatar")).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
