import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

import type { ToolView } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { ToolGroup } from "./ToolGroup";

test("tool rows expose individual status without an intermediate accordion", () => {
  const tools: ToolView[] = [
    { id: "one", name: "read", status: "error" },
    { id: "two", name: "read", status: "running" },
    { id: "three", name: "read", status: "waiting" },
    { id: "four", name: "bash", status: "success" },
  ];
  const html = renderToStaticMarkup(<ToolGroup tools={tools} hasPreamble={false} />);
  const summary = html.slice(html.indexOf("<summary>"), html.indexOf("</summary>"));

  expect(summary).toContain("Used tool");
  expect(summary).toContain("read");
  expect(summary).toContain('aria-label="Error"');
  expect(html).not.toContain("tool-group-disclosure");
  expect(html).not.toContain(" open=");
  expect(html.match(/class="tool-card"/g)).toHaveLength(4);
  expect(html.match(/<summary>/g)).toHaveLength(4);
  expect(html).toContain("Use tools");

  for (const [status, label, path] of [
    ["running", "Running", "M12 3a9 9 0 1 1-9 9"],
    ["success", "Completed", "m8 12 3 3 5-6"],
    ["error", "Error", "m9 9 6 6m0-6-6 6"],
  ] as const) {
    const row = renderToStaticMarkup(
      <ToolGroup tools={[{ id: "one", name: "bash", status }]} hasPreamble />,
    );
    expect(row).toContain(`class="tool-card" data-status="${status}"`);
    expect(row).toContain(`aria-label="${label}"`);
    expect(row).toContain(`d="${path}"`);
  }
});

test("fast tool icons settle independently while results, failures and open details update immediately", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, waitFor } = await import("@testing-library/react/pure");
  const first: ToolView = { id: "first", name: "bash", status: "running" };
  const second: ToolView = { id: "second", name: "bash", status: "waiting" };
  try {
    const ui = render(<ToolGroup tools={[first, second]} hasPreamble />);
    const cards = ui.container.querySelectorAll<HTMLDetailsElement>(".tool-card");
    cards[0]!.open = true;
    const completed: ToolView = {
      ...first,
      status: "success",
      result: {
        role: "toolResult",
        toolCallId: first.id,
        toolName: first.name,
        content: [{ type: "text", text: "Example output" }],
        isError: false,
        timestamp: 0,
      },
    };
    ui.rerender(<ToolGroup tools={[completed, { ...second, status: "running" }]} hasPreamble />);
    expect(cards[0]!.dataset.status).toBe("success");
    expect(cards[0]!.textContent).toContain("Example output");
    expect(cards[0]!.querySelector("svg")?.getAttribute("data-status")).toBe("running");
    expect(cards[0]!.querySelector("svg")?.getAttribute("aria-label")).toBe("Completed");
    expect(cards[1]!.querySelector("svg")?.getAttribute("data-status")).toBe("running");
    ui.rerender(<ToolGroup tools={[completed, { ...second, status: "error" }]} hasPreamble />);
    expect(cards[1]!.querySelector("svg")?.getAttribute("data-status")).toBe("error");
    await waitFor(() =>
      expect(cards[0]!.querySelector("svg")?.getAttribute("data-status")).toBe("success"),
    );
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(ui.container.querySelector(".tool-card")).toBe(cards[0]!);
    expect(cards[0]!.open).toBe(true);
    ui.unmount();
    const history = render(<ToolGroup tools={[completed]} hasPreamble />);
    expect(history.container.querySelector("svg")?.getAttribute("data-status")).toBe("success");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("fallback describes only the tool action, respects authored text and supports both languages", async () => {
  const previous = i18n.language;

  try {
    for (const [language, labels] of [
      ["en", ["Read files", "Write files", "Edit files", "Run commands", "Use tools"]],
      ["zh", ["读取文件", "写入文件", "编辑文件", "执行命令", "使用工具"]],
    ] as const) {
      await i18n.changeLanguage(language);

      for (const [index, name] of ["read", "write", "edit", "bash", "unknown"].entries()) {
        const tools: ToolView[] = [{ id: "one", name, status: "success" }];
        const html = renderToStaticMarkup(<ToolGroup tools={tools} hasPreamble={false} />);

        expect(html).toContain(labels[index]!);
        expect(html).toContain(language === "zh" ? "调用工具" : "Used tool");
        expect(renderToStaticMarkup(<ToolGroup tools={tools} hasPreamble />)).not.toContain(
          "tool-group-preamble",
        );
      }

      expect(
        renderToStaticMarkup(
          <ToolGroup
            tools={[
              { id: "one", name: "read", status: "error" },
              { id: "two", name: "bash", status: "error" },
            ]}
            hasPreamble={false}
          />,
        ),
      ).toContain(labels[4]);
    }
  } finally {
    await i18n.changeLanguage(previous);
  }
});
