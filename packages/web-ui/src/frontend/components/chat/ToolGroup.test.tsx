import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

import type { ToolView } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { ToolGroup } from "./ToolGroup";

test("tool batches default to a single collapsed live row and finish with a summary", () => {
  const tools: ToolView[] = [
    { id: "one", name: "read", args: { path: "config.ts" }, status: "success" },
    { id: "two", name: "bash", args: { command: "pnpm test" }, status: "running" },
    { id: "three", name: "edit", args: { path: "src/app.ts" }, status: "waiting" },
  ];
  const html = renderToStaticMarkup(<ToolGroup tools={tools} />);
  const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
  expect(summary).toContain("Running pnpm test");
  expect(summary).not.toContain("Read files");
  expect(summary).not.toContain("tool-card");
  expect(html).toContain('class="tool-group" data-active="true" aria-busy="true"');
  expect(html).not.toContain(" open=");
  expect(html.match(/class="tool-card"/g)).toHaveLength(3);

  const generating = renderToStaticMarkup(<ToolGroup tools={tools} generating />);
  expect(
    generating.slice(generating.indexOf("<summary"), generating.indexOf("</summary>")),
  ).toContain("Edit src/app.ts");

  const completed = tools.map((tool) => ({ ...tool, status: "success" as const }));
  const history = renderToStaticMarkup(<ToolGroup tools={completed} />);
  expect(history).toContain('data-active="false" aria-busy="false"');
  expect(history).toContain("Read files, Ran commands and Edited files");
  expect(history).not.toContain(" open=");
  expect(renderToStaticMarkup(<ToolGroup tools={[]} />)).toBe("");
});

test("fast tool icons settle independently while results, failures and open details update immediately", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, waitFor, act } = await import("@testing-library/react/pure");
  const first: ToolView = { id: "first", name: "bash", status: "running" };
  const second: ToolView = { id: "second", name: "bash", status: "waiting" };
  try {
    const ui = render(<ToolGroup tools={[first, second]} />);
    const group = ui.container.querySelector<HTMLDetailsElement>(".tool-group")!;
    expect(group.open).toBe(false);
    expect(group.querySelector(".tool-group-label")?.textContent).toBe("Running command");
    group.open = true;
    const cards = ui.container.querySelectorAll<HTMLDetailsElement>(".tool-card");
    cards[0]!.open = true;
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Running command");
    ui.rerender(<ToolGroup tools={[{ ...first, args: { command: "bun" } }, second]} />);
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Running bun");
    ui.rerender(
      <ToolGroup
        tools={[
          { ...first, args: { command: "pnpm test", description: "Check the project" } },
          second,
        ]}
      />,
    );
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Running pnpm test");
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
    ui.rerender(<ToolGroup tools={[completed, { ...second, status: "running" }]} />);
    expect(group.querySelector(".tool-group-label")?.textContent).toBe("Running command");
    expect(cards[0]!.dataset.status).toBe("success");
    expect(cards[0]!.querySelector(".tool-card-label")?.textContent).toBe("Ran pnpm test");
    expect(cards[0]!.textContent).toContain("Example output");
    expect(cards[0]!.querySelector(".tool-status-icon")?.getAttribute("data-status")).toBe(
      "running",
    );
    expect(cards[0]!.querySelector(".tool-status-icon")?.getAttribute("aria-label")).toBe(
      "Completed",
    );
    expect(cards[1]!.querySelector(".tool-status-icon")?.getAttribute("data-status")).toBe(
      "running",
    );
    ui.rerender(<ToolGroup tools={[completed, { ...second, status: "error" }]} />);
    expect(group.dataset.active).toBe("false");
    expect(group.querySelector(".tool-group-label")?.textContent).toBe(
      "Ran 1 command and 1 tool failed",
    );
    expect(cards[1]!.querySelector(".tool-status-icon")?.getAttribute("data-status")).toBe("error");
    await waitFor(() =>
      expect(cards[0]!.querySelector(".tool-status-icon")?.getAttribute("data-status")).toBe(
        "success",
      ),
    );
    expect(ui.container.querySelectorAll(".tool-card")).toHaveLength(2);
    expect(ui.container.querySelector(".tool-card")).toBe(cards[0]!);
    expect(ui.container.querySelector(".tool-group")).toBe(group);
    expect(group.open).toBe(true);
    expect(cards[0]!.open).toBe(true);
    ui.rerender(
      <ToolGroup
        tools={[
          completed,
          { ...second, status: "error" },
          { id: "third", name: "read", status: "waiting" },
        ]}
      />,
    );
    expect(ui.container.querySelector(".tool-group-label")?.textContent).toBe("Read file");
    expect(group.dataset.active).toBe("true");
    expect(ui.container.querySelector(".tool-card")).toBe(cards[0]!);
    expect(ui.container.querySelector(".tool-group")).toBe(group);
    expect(group.open).toBe(true);
    expect(cards[0]!.open).toBe(true);
    ui.unmount();
    const history = render(<ToolGroup tools={[completed]} />);
    expect(history.container.querySelector<HTMLDetailsElement>(".tool-group")?.open).toBe(false);
    expect(history.container.querySelector(".tool-card-label")?.textContent).toBe("Ran pnpm test");
    expect(history.container.querySelector(".tool-status-icon")?.getAttribute("data-status")).toBe(
      "success",
    );
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

test("batch summaries describe completed actions and support both languages", async () => {
  const previous = i18n.language;

  try {
    for (const [language, labels, rowLabels, combined] of [
      [
        "en",
        ["Read 1 file", "Wrote 1 file", "Edited 1 file", "Ran 1 command", "Used unknown"],
        ["Read", "Wrote", "Edited", "Ran", "Used tool"],
        "2 tools failed",
      ],
      [
        "zh",
        [
          "已读取 1 个文件",
          "已写入 1 个文件",
          "已编辑 1 个文件",
          "已执行 1 条命令",
          "已调用 unknown",
        ],
        ["已读取", "已写入", "已编辑", "已执行", "已调用工具"],
        "2 次工具调用失败",
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
        const html = renderToStaticMarkup(<ToolGroup tools={tools} />);

        expect(html).toContain(labels[index]!);
        expect(html).toContain(`title="${rowLabels[index]} ${target}"`);
      }

      expect(
        renderToStaticMarkup(
          <ToolGroup
            tools={[
              { id: "one", name: "read", status: "error" },
              { id: "two", name: "bash", status: "error" },
            ]}
          />,
        ),
      ).toContain(combined);
    }
  } finally {
    await i18n.changeLanguage(previous);
  }
});
