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
    "Ask the user questions to clarify requirements, gather preferences or constraints, or resolve implementation choices that materially affect the result.\n\nInvestigate information available in the workspace first. Make reasonable decisions for low-impact, reversible details. Ask when the answer requires the user's judgment or information you cannot discover.\n\nProvide one or more questions, each with a clear, self-contained title. For choice questions, include a non-empty options array of strings. Put the recommended option first and append a localized recommendation marker to that option, not the title. Omit options for free-text questions. Do not request secrets.\n\nThe user can choose an option, enter a custom answer, or skip questions. The first option is preselected but is not submitted automatically. This tool waits for the user's response; then continue using the answers provided. Answers do not grant execution permissions.",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "Question text only; put recommendation markers in the relevant option string, not here.",
              minLength: 1,
              maxLength: 2000,
            },
            options: {
              type: "array",
              description:
                "Single-choice suggestions. Append any recommendation marker to the recommended option string, e.g. Continue (Recommended). The first is preselected without submitting. Users can also enter custom text. Omit for free-text questions.",
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
