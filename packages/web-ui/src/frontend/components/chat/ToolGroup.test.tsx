import { expect, test } from "vitest";
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

  expect(summary).toContain('title="Read file"');
  expect(summary).not.toContain("Used tool");
  expect(summary).toContain('aria-label="Error"');
  expect(html).not.toContain("tool-group-disclosure");
  expect(html).not.toContain(" open=");
  expect(html.match(/class="tool-card"/g)).toHaveLength(4);
  expect(html.match(/<summary>/g)).toHaveLength(4);
  expect(html).toContain("Read files and Run commands");
  expect(html).not.toContain("Use tools");

  for (const [status, label, path] of [
    ["running", "Running", "M12 3a9 9 0 1 1-9 9"],
    ["success", "Completed", "m8 12 3 3 5-6"],
    ["error", "Error", "m9 9 6 6m0-6-6 6"],
  ] as const) {
    const row = renderToStaticMarkup(
      <ToolGroup
        tools={[{ id: "one", name: "bash", args: { command: "pnpm test" }, status }]}
        hasPreamble
      />,
    );
    expect(row).toContain('title="Bash · pnpm test"');
    expect(row).toContain(`class="tool-card" data-status="${status}"`);
    expect(row).toContain(`aria-label="${label}"`);
    expect(row).toContain(`d="${path}"`);
  }
});

test("fast tool icons settle independently while results, failures and open details update immediately", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, waitFor, act } = await import("@testing-library/react/pure");
  const first: ToolView = { id: "first", name: "bash", status: "running" };
  const second: ToolView = { id: "second", name: "bash", status: "waiting" };
  try {
    const ui = render(<ToolGroup tools={[first, second]} hasPreamble />);
    const cards = ui.container.querySelectorAll<HTMLDetailsElement>(".tool-card");
    cards[0]!.open = true;
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Bash · command");
    ui.rerender(<ToolGroup tools={[{ ...first, args: { command: "bun" } }, second]} hasPreamble />);
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Bash · bun");
    ui.rerender(
      <ToolGroup
        tools={[
          { ...first, args: { command: "pnpm test", description: "Check the project" } },
          second,
        ]}
        hasPreamble
      />,
    );
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Bash · pnpm test");
    expect(cards[0]!.open).toBe(true);
    expect(cards[0]!.querySelector("pre")?.textContent).toContain("pnpm test");
    const completed: ToolView = {
      ...first,
      args: { command: "pnpm test", description: "Check the project" },
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
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Bash · pnpm test");
    expect(cards[0]!.textContent).toContain("Example output");
    expect(cards[0]!.querySelector(".activity-status-icon")?.getAttribute("data-status")).toBe(
      "running",
    );
    expect(cards[0]!.querySelector(".activity-status-icon")?.getAttribute("aria-label")).toBe(
      "Completed",
    );
    expect(cards[1]!.querySelector(".activity-status-icon")?.getAttribute("data-status")).toBe(
      "running",
    );
    ui.rerender(<ToolGroup tools={[completed, { ...second, status: "error" }]} hasPreamble />);
    expect(cards[1]!.querySelector(".activity-status-icon")?.getAttribute("data-status")).toBe(
      "error",
    );
    await waitFor(() =>
      expect(cards[0]!.querySelector(".activity-status-icon")?.getAttribute("data-status")).toBe(
        "success",
      ),
    );
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(ui.container.querySelector(".tool-card")).toBe(cards[0]!);
    expect(cards[0]!.open).toBe(true);
    ui.rerender(
      <ToolGroup
        tools={[
          completed,
          { ...second, status: "error" },
          { id: "third", name: "read", status: "waiting" },
        ]}
        hasPreamble={false}
      />,
    );
    expect(ui.container.querySelector(".tool-group-preamble")?.textContent).toBe(
      "Run commands and Read files",
    );
    expect(ui.container.querySelector(".tool-card")).toBe(cards[0]!);
    expect(cards[0]!.open).toBe(true);
    ui.unmount();
    const history = render(<ToolGroup tools={[completed]} hasPreamble />);
    expect(history.container.querySelector(".tool-card-label")?.textContent).toBe(
      "Bash · pnpm test",
    );
    expect(
      history.container.querySelector(".activity-status-icon")?.getAttribute("data-status"),
    ).toBe("success");
  } finally {
    try {
      await act(async () => {
        cleanup();
        // React can still have a passive-effect callback queued in the Node scheduler.
        await new Promise<void>((resolve) => setImmediate(resolve));
      });
      await window.happyDOM.close();
    } finally {
      Object.assign(globalThis, previous);
    }
  }
});

test("fallback describes only the tool action, respects authored text and supports both languages", async () => {
  const previous = i18n.language;

  try {
    for (const [language, labels, rowLabels, combined] of [
      [
        "en",
        ["Read 1 file", "Write 1 file", "Edit 1 file", "Run 1 command", "Use unknown"],
        ["Read", "Wrote", "Edited", "Bash ·", "Used tool"],
        "Read files and Run commands",
      ],
      [
        "zh",
        ["读取 1 个文件", "写入 1 个文件", "编辑 1 个文件", "执行 1 条命令", "调用 unknown"],
        ["已读取", "已写入", "已编辑", "Bash ·", "已调用工具"],
        "读取文件并执行命令",
      ],
    ] as const) {
      await i18n.changeLanguage(language);

      for (const [index, name] of ["read", "write", "edit", "bash", "unknown"].entries()) {
        const target = name === "bash" ? "pnpm test" : name === "unknown" ? name : "src/app.ts";
        const tools: ToolView[] = [
          {
            id: "one",
            name,
            status: "success",
            args: { path: "src/app.ts", command: "pnpm test" },
          },
        ];
        const html = renderToStaticMarkup(<ToolGroup tools={tools} hasPreamble={false} />);

        expect(html).toContain(labels[index]!);
        expect(html).toContain(`title="${rowLabels[index]} ${target}"`);
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
      ).toContain(combined);
    }
  } finally {
    await i18n.changeLanguage(previous);
  }
});
