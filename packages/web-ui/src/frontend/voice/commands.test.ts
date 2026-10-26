import { expect, test } from "vitest";

import { parseSpokenCommand } from "./commands";

test("only complete explicit control phrases change task state", () => {
  expect(parseSpokenCommand("停止任务。 ")).toEqual({ action: "abort" });
  expect(parseSpokenCommand("继续任务")).toEqual({ action: "resume" });
  expect(parseSpokenCommand("Resume the task!")).toEqual({ action: "resume" });
  expect(parseSpokenCommand("Explain how to stop task")).toEqual({
    action: "prompt",
    text: "Explain how to stop task",
    steering: false,
  });
  expect(parseSpokenCommand("调整要求：仅检查类型")).toEqual({
    action: "prompt",
    text: "仅检查类型",
    steering: true,
  });
  expect(parseSpokenCommand("纠正方向：")).toEqual({ action: "empty" });
  expect(parseSpokenCommand("调整要求。")).toEqual({ action: "empty" });
  expect(parseSpokenCommand("调整要求只检查类型")).toEqual({
    action: "prompt",
    text: "只检查类型",
    steering: true,
  });
  expect(parseSpokenCommand("more tests", true)).toEqual({
    action: "prompt",
    text: "more tests",
    steering: true,
  });
});
