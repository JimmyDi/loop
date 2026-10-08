import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

import type { ToolView } from "../../../shared/protocol";
import "../../i18n/setup";
import { ToolCard } from "./ToolCard";

test("collapsed ToolCard exposes its accessible header and state without detail content", () => {
  const html = renderToStaticMarkup(
    <ToolCard
      tool={{
        id: "call",
        name: "read",
        args: { path: "src/app.ts" },
        status: "error",
        result: {
          role: "toolResult",
          toolCallId: "call",
          toolName: "read",
          isError: true,
          content: [{ type: "text", text: "Missing file" }],
          timestamp: 0,
        },
      }}
    />,
  );

  expect(html).toContain('data-status="error"');
  expect(html).toContain('title="Read src/app.ts"');
  expect(html).not.toContain("Missing file");
  expect(html).not.toContain("tool-content");
});

test("tool details format only while visible, release on collapse and reopen with current output", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act, fireEvent } = await import("@testing-library/react/pure");
  const formatArgument = vi.fn(() => "large argument ".repeat(10000));
  const output = "large result ".repeat(10000);
  const readContent = vi.fn();
  const result: NonNullable<ToolView["result"]> = {
    role: "toolResult",
    toolCallId: "call",
    toolName: "read",
    isError: false,
    get content() {
      readContent();
      return [{ type: "text" as const, text: output }];
    },
    timestamp: 0,
  };
  const tool: ToolView = {
    id: "call",
    name: "read",
    args: { path: "src/app.ts", payload: { toJSON: formatArgument } },
    status: "success",
    result,
  };
  try {
    const ui = render(<ToolCard tool={tool} />);
    const card = ui.container.querySelector<HTMLDetailsElement>(".tool-card")!;
    const toggle = (open: boolean) =>
      act(() => {
        card.open = open;
        fireEvent(card, new globalThis.window.Event("toggle"));
      });
    expect(ui.container.querySelector("pre")).toBeNull();
    expect(formatArgument).not.toHaveBeenCalled();
    expect(readContent).not.toHaveBeenCalled();
    toggle(true);
    expect(card.querySelectorAll("pre")).toHaveLength(2);
    expect(card.querySelectorAll("pre")[1]!.textContent).toBe(output);
    expect(formatArgument).toHaveBeenCalled();
    formatArgument.mockClear();
    readContent.mockClear();
    ui.rerender(<ToolCard tool={tool} detailsVisible={false} />);
    expect(card.open).toBe(true);
    expect(card.querySelector(".tool-content")).toBeNull();
    expect(formatArgument).not.toHaveBeenCalled();
    expect(readContent).not.toHaveBeenCalled();
    const updated = {
      ...tool,
      status: "error" as const,
      args: { path: "src/app.ts", offset: 42 },
      result: {
        ...result,
        isError: true,
        content: [{ type: "text" as const, text: "Latest output" }],
      },
    };
    ui.rerender(<ToolCard tool={updated} detailsVisible={false} />);
    expect(card.dataset.status).toBe("error");
    expect(card.querySelector("pre")).toBeNull();
    ui.rerender(<ToolCard tool={updated} />);
    expect(card.open).toBe(true);
    expect(card.querySelectorAll("pre")[0]!.textContent).toContain('\"offset\": 42');
    expect(card.querySelectorAll("pre")[1]!.textContent).toBe("Latest output");
    toggle(false);
    expect(card.querySelector(".tool-content")).toBeNull();
    toggle(true);
    expect(card.querySelectorAll("pre")[1]!.textContent).toBe("Latest output");
    expect(ui.container.querySelector(".tool-card")).toBe(card);
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
