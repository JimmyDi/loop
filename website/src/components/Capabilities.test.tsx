import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Capabilities } from "./Capabilities";

afterEach(cleanup);

it("shows three capabilities without the permission section", () => {
  render(<Capabilities />);
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.queryByText("明确边界，再开始。")).toBeNull();
  expect(screen.getByRole("heading", { name: "长任务，也能掌握节奏。" })).toBeTruthy();
  expect(screen.getByText(/排队安排后续工作，插队调整当前方向，还能修改待执行消息/)).toBeTruthy();
  expect(screen.getByText(/手动或自动压缩上下文/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "接入工具，复用工程经验。" })).toBeTruthy();
  expect(screen.getByText(/支持 STDIO 和 Streamable HTTP MCP/)).toBeTruthy();
  expect(
    screen.getByText(/用 Skills 将项目规范、评审清单和常用流程沉淀为可复用的能力/),
  ).toBeTruthy();
});
