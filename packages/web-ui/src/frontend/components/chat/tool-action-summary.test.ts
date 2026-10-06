import { expect, test } from "vitest";

import type { ToolView } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { toolActionSummary } from "./tool-action-summary";

test("MCP completion summaries use display names independently of internal IDs", () => {
  const tools: ToolView[] = [
    {
      id: "call",
      name: "mcp_internal_hash",
      displayName: "Example · list_directory",
      status: "success",
    },
  ];
  expect(toolActionSummary(tools, i18n.getFixedT("en"))).toBe("Used Example · list_directory");
});
test("completed summaries count homogeneous batches and combine actions in order", () => {
  const cases: [string[], string, string][] = [
    [[], "", ""],
    [["read"], "Read 1 file", "已读取 1 个文件"],
    [["read", "read", "read"], "Read 3 files", "已读取 3 个文件"],
    [["bash", "bash"], "Ran 2 commands", "已执行 2 条命令"],
    [["read", "bash", "read"], "Read files and Ran commands", "已读取文件、已执行命令"],
    [["edit", "bash"], "Edited files and Ran commands", "已编辑文件、已执行命令"],
    [
      ["write", "read", "bash"],
      "Wrote files, Read files and Ran commands",
      "已写入文件、已读取文件、已执行命令",
    ],
    [["search", "read", "search"], "Used search and Read files", "已调用 search、已读取文件"],
    [[""], "Used tools", "已调用工具"],
  ];
  for (const [names, en, zh] of cases) {
    const tools: ToolView[] = names.map((name, index) => ({
      id: String(index),
      name,
      status: "success",
    }));
    const before = structuredClone(tools);
    expect(toolActionSummary(tools, i18n.getFixedT("en"))).toBe(en);
    expect(toolActionSummary(tools, i18n.getFixedT("zh"))).toBe(zh);
    expect(tools).toEqual(before);
  }
});

test("failures remain explicit without claiming unfinished or failed actions succeeded", () => {
  const tools: ToolView[] = [
    { id: "a", name: "read", status: "success" },
    { id: "b", name: "edit", status: "error" },
    { id: "c", name: "bash", status: "waiting" },
    { id: "d", name: "write", status: "running" },
  ];
  expect(toolActionSummary(tools, i18n.getFixedT("en"))).toBe("Read 1 file and 1 tool failed");
  expect(toolActionSummary(tools, i18n.getFixedT("zh"))).toBe("已读取 1 个文件、1 次工具调用失败");
  expect(toolActionSummary([{ ...tools[1]!, status: "error" }], i18n.getFixedT("en"))).toBe(
    "1 tool failed",
  );
});
