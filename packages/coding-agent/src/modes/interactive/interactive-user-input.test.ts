import { expect, test } from "vitest";

import type { AgentSession } from "../../core/agent-session";
import type { UserInputHandler, UserInputResponse } from "../../core/user-input/types";
import { InteractiveUserInput } from "./interactive-user-input";

test("CLI collects choice and free text across questions without consuming commands", () => {
  let handler!: UserInputHandler;
  const responses: UserInputResponse[] = [];
  const lines: string[] = [];
  const session = {
    registerUserInputHandler: (callback: UserInputHandler) => {
      handler = callback;
      return () => {};
    },
    respondToUserInput: (response: UserInputResponse) => {
      responses.push(structuredClone(response));
      return true;
    },
    subscribe: () => () => {},
  } as unknown as AgentSession;
  const ui = new InteractiveUserInput((text) => lines.push(text), true);
  ui.bind(session);
  handler({
    sessionId: "session",
    requestId: "request",
    createdAt: 0,
    questions: [
      {
        id: "q",
        text: "Pick a strategy",
        options: [
          { id: "a", label: "Automatic" },
          { id: "m", label: "Manual" },
        ],
        recommendedOptionId: "a",
      },
      { id: "name", text: "Provide a name" },
    ],
  });
  expect(responses).toEqual([]);
  expect(lines[0]).toContain("recommended");
  expect(lines[0]).toContain("/skip is available.");
  expect(ui.handle("/abort")).toBe(false);
  expect(ui.handle("2")).toBe(true);
  expect(responses).toEqual([]);
  expect(ui.handle("Example")).toBe(true);
  expect(responses[0]?.answers).toEqual([
    { questionId: "q", type: "option", optionId: "m" },
    { questionId: "name", type: "text", text: "Example" },
  ]);
  ui.dispose();
});

test("CLI accepts the default only on Enter and rejects blank text before advancing", () => {
  let handler!: UserInputHandler;
  const responses: UserInputResponse[] = [];
  const session = {
    registerUserInputHandler: (callback: UserInputHandler) => {
      handler = callback;
      return () => {};
    },
    respondToUserInput: (response: UserInputResponse) => {
      responses.push(structuredClone(response));
      return true;
    },
    subscribe: () => () => {},
  } as unknown as AgentSession;
  const ui = new InteractiveUserInput(() => {}, true);
  ui.bind(session);
  handler({
    sessionId: "s",
    requestId: "r",
    createdAt: 0,
    questions: [
      { id: "choice", text: "Choose?", options: [{ id: "first", label: "First" }] },
      { id: "details", text: "Details?" },
    ],
  });
  expect(responses).toEqual([]);
  expect(ui.handle("")).toBe(true);
  expect(responses).toEqual([]);
  expect(() => ui.handle("")).toThrow("Enter an answer");
  expect(ui.handle("Custom details")).toBe(true);
  expect(responses[0]?.answers).toEqual([
    { questionId: "choice", type: "option", optionId: "first" },
    { questionId: "details", type: "text", text: "Custom details" },
  ]);
  ui.dispose();
});
