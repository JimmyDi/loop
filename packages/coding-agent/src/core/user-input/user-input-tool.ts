import type { AgentTool } from "@loop/agent";

import type { UserInputQuestion } from "./types";
import type { UserInputService } from "./user-input-service";
import { validQuestions } from "./validation";

const normalizeQuestions = (value: unknown): UserInputQuestion[] => {
  if (!Array.isArray(value)) throw new Error("Invalid user input questions");
  const questions = value.map((question, index) => {
    if (
      !question ||
      typeof question !== "object" ||
      Array.isArray(question) ||
      Object.keys(question).some((key) => key !== "title" && key !== "options") ||
      typeof question.title !== "string" ||
      (question.options !== undefined &&
        (!Array.isArray(question.options) ||
          !question.options.every((option: unknown) => typeof option === "string")))
    )
      throw new Error("Invalid user input questions");
    return {
      id: "question-" + (index + 1),
      text: question.title,
      ...(question.options === undefined
        ? {}
        : {
            options: question.options.map((label: string, optionIndex: number) => ({
              id: "option-" + (optionIndex + 1),
              label,
            })),
          }),
    };
  });
  if (!validQuestions(questions)) throw new Error("Invalid user input questions");
  return questions;
};

export const createUserInputTool = (service?: UserInputService): AgentTool => ({
  name: "request_user_input",
  description:
    "Ask about a consequential choice or missing requirement, then wait for the user. Investigate discoverable facts first; decide low-impact reversible details yourself. Supply at least one question with a title. For a choice between concrete alternatives, provide a non-empty options array of strings; do not put choices only in the title. Omit options for free-text questions. Choice questions also accept custom text. The first option is preselected, but answers require explicit user submission. Answers do not grant execution permissions. Do not request secrets.",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 2000 },
            options: {
              type: "array",
              description:
                "Single-choice suggestions; the first is preselected without submitting. Users can also enter custom text. Omit for free-text questions.",
              minItems: 1,
              items: { type: "string", minLength: 1, maxLength: 300 },
            },
          },
          required: ["title"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  execute: async (args, signal) => {
    if (Object.keys(args).some((key) => key !== "questions")) {
      throw new Error("Invalid user input questions");
    }
    const questions = normalizeQuestions(args.questions);
    if (!service) throw new Error("User input is unavailable");
    const result = await service.request(questions, signal);
    signal.throwIfAborted();
    return [{ type: "text", text: JSON.stringify(result) }];
  },
});
