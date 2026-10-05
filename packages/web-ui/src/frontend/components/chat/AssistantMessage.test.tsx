import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Message } from "../../../shared/protocol";
import "../../i18n/setup";
import { AssistantMessage } from "./AssistantMessage";
import { projectTools } from "../../../shared/tool-projection";

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

test("authored updates stay visible and opened tool rows survive growing drafts and results", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const message: Extract<Message, { role: "assistant" }> = {
    role: "assistant",
    content: [
      { type: "text", text: "Read the configuration." },
      { type: "toolCall", id: "first", name: "read", arguments: {} },
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

  try {
    const ui = render(
      <AssistantMessage message={message} tools={projectTools([message])} streaming />,
    );
    const group = ui.container.querySelector(".tool-group")!;
    expect(group.contains(ui.getByText("Read the configuration."))).toBe(false);
    expect(ui.container.querySelector(".tool-group-preamble")).toBeNull();
    const card = ui.container.querySelector<HTMLDetailsElement>(".tool-card")!;
    expect(card.open).toBe(false);
    card.open = true;

    const completed: typeof message = {
      ...message,
      content: [
        message.content[0]!,
        { type: "toolCall", id: "first", name: "read", arguments: { path: "config.ts" } },
        { type: "toolCall", id: "second", name: "read", arguments: { path: "entry.ts" } },
      ],
    };
    ui.rerender(
      <AssistantMessage message={completed} tools={projectTools([completed])} streaming />,
    );
    expect(ui.container.querySelector(".tool-group")).toBe(group);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);
    expect(group.querySelectorAll(".tool-card > summary")).toHaveLength(2);
    expect(card.textContent).toContain("config.ts");

    const results: Message[] = [
      {
        role: "toolResult",
        toolCallId: "first",
        toolName: "read",
        content: [{ type: "text", text: "File contents" }],
        isError: false,
        timestamp: 0,
      },
      {
        role: "toolResult",
        toolCallId: "second",
        toolName: "read",
        content: [{ type: "text", text: "Cancelled" }],
        isError: true,
        timestamp: 0,
      },
    ];
    ui.rerender(
      <AssistantMessage message={completed} tools={projectTools([completed, ...results])} />,
    );
    expect(ui.container.querySelector(".tool-group")).toBe(group);
    expect(ui.container.querySelector(".tool-card")).toBe(card);
    expect(card.open).toBe(true);
    expect(card.querySelector(".activity-status-icon")?.getAttribute("data-status")).toBe(
      "success",
    );
    expect(group.querySelectorAll('.activity-status-icon[data-status="error"]')).toHaveLength(1);
    expect(card.textContent).toContain("File contents");
    expect(group.textContent).toContain("Cancelled");
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
