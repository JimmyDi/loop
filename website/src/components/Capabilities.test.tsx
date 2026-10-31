import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Capabilities } from "./Capabilities";

afterEach(cleanup);

it("leads with phone and voice benefits and keeps essential usage notes", () => {
  render(<Capabilities />);
  expect(screen.getAllByRole("article")).toHaveLength(5);
  expect(
    screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
  ).toEqual([
    "离开座位，任务不停。",
    "本地语音，开口就能做。",
    "长任务，也能掌握节奏。",
    "35 个 provider。模型由你选择。",
    "接入工具，复用工程经验。",
  ]);
  expect(screen.getByText(/模型、节奏、工具与设备都由你掌握/)).toBeTruthy();
  expect(screen.getByText(/仅配对你信任的设备，它们可访问你的全部会话/)).toBeTruthy();
  expect(screen.getByText(/需在支持的平台安装语音组件/)).toBeTruthy();
  expect(screen.queryByText("明确边界，再开始。")).toBeNull();
  expect(screen.getByRole("heading", { name: "长任务，也能掌握节奏。" })).toBeTruthy();
  expect(screen.getByText(/把后续工作排好队/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "接入工具，复用工程经验。" })).toBeTruthy();
  expect(screen.getByText(/通过 MCP 连接常用工具，用 Skills 留住项目规范和拿手流程/)).toBeTruthy();
});
