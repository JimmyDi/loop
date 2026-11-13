import { expect, test } from "vitest";

import { createUserInputTool } from "./user-input-tool";
import { UserInputService } from "./user-input-service";

test("tool reports unavailable interaction as a result and never invents an answer", async () => {
  const service = new UserInputService("s", () => {});
  const tool = createUserInputTool(service);
  const content = await tool.execute(
    { questions: [{ title: "Choose a strategy" }] },
    new AbortController().signal,
  );
  expect(content).toHaveLength(1);
  expect(content[0]).toMatchObject({ type: "text" });
  if (content[0]?.type === "text") {
    const result = JSON.parse(content[0].text);
    expect(result.outcome).toBe("unavailable");
    expect(result).not.toHaveProperty("answers");
  }
  await expect(tool.execute({ questions: [] }, new AbortController().signal)).rejects.toThrow(
    "Invalid",
  );
  service.dispose();
});

test("normalizes mixed question shapes and waits for an explicit atomic answer", async () => {
  const service = new UserInputService("s", () => {});
  service.registerHandler(() => {});
  const tool = createUserInputTool(service);
  const waiting = tool.execute(
    {
      questions: [
        { title: "Next step?", options: ["Continue"] },
        { title: "Details?" },
        { title: "Another choice?", options: ["A", "B", "C", "D", "E", "F", "G"] },
        { title: "More details?" },
      ],
    },
    new AbortController().signal,
  );
  const request = service.pending[0]!;
  expect(request.questions).toHaveLength(4);
  expect(request.questions[0]).toEqual({
    id: "question-1",
    text: "Next step?",
    options: [{ id: "option-1", label: "Continue" }],
  });
  expect(request.questions[1]).toEqual({ id: "question-2", text: "Details?" });
  expect(service.pending).toHaveLength(1);
  expect(
    service.respond({
      ...request,
      answers: [
        { questionId: "question-1", type: "option", optionId: "option-1" },
        { questionId: "question-2", type: "text", text: "Details" },
        { questionId: "question-3", type: "text", text: "Custom choice" },
        { questionId: "question-4", type: "text", text: "More" },
      ],
    }),
  ).toBe(true);
  const content = await waiting;
  expect(content[0]).toMatchObject({
    type: "text",
    text: expect.stringContaining('"outcome":"answered"'),
  });
  service.dispose();
});

test.each([
  {},
  { questions: [] },
  { questions: [{ title: " " }] },
  { questions: [{ title: "Pick?", options: [] }] },
  { questions: [{ title: "Pick?", options: [" "] }] },
  { questions: [{ title: "Pick?", options: [1] }] },
  { questions: [{ title: "Pick?", options: [{ id: "a", label: "A" }] }] },
  { questions: [{ title: "Pick?", options: null }] },
  { questions: [{ title: "Pick?", type: "text" }] },
  { questions: [{ id: "q", text: "Old shape?" }] },
  { questions: [null] },
  { questions: [{ title: "Pick?" }], type: "text" },
])("rejects malformed or unsupported question arguments: %j", async (args) => {
  await expect(createUserInputTool().execute(args, new AbortController().signal)).rejects.toThrow(
    "Invalid",
  );
});
