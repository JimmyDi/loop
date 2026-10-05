import { expect, test } from "vitest";

import type { ToolView } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { toolActionSummary } from "./tool-action-summary";

test("action summaries count homogeneous batches and combine observed actions in order", () => {
  const cases: [string[], string, string][] = [
    [[], "", ""],
    [["read"], "Read 1 file", "读取 1 个文件"],
    [["read", "read", "read"], "Read 3 files", "读取 3 个文件"],
    [["bash", "bash"], "Run 2 commands", "执行 2 条命令"],
    [["read", "bash", "read"], "Read files and Run commands", "读取文件并执行命令"],
    [["edit", "bash"], "Edit files and Run commands", "编辑文件并执行命令"],
    [
      ["write", "read", "bash"],
      "Write files, Read files and Run commands",
      "写入文件、读取文件并执行命令",
    ],
    [["search", "read", "search"], "Use search and Read files", "调用 search并读取文件"],
    [[""], "Use tools", "使用工具"],
  ];
  for (const [names, en, zh] of cases) {
    const tools: ToolView[] = names.map((name, index) => ({
      id: String(index),
      name,
      status: index % 2 ? "running" : "error",
    }));
    const before = structuredClone(tools);
    expect(toolActionSummary(tools, i18n.getFixedT("en"))).toBe(en);
    expect(toolActionSummary(tools, i18n.getFixedT("zh"))).toBe(zh);
    expect(tools).toEqual(before);
  }
});
