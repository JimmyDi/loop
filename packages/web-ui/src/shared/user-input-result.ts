import type { ToolView, UserInputResult } from "./protocol";
import { messageText } from "./message-text";

/** Persisted tool content may come from older or malformed session files. */
export const userInputResult = (tool: ToolView): UserInputResult | undefined => {
  if (tool.name !== "request_user_input" || !tool.result || tool.result.isError) return;
  try {
    const value = JSON.parse(messageText(tool.result)) as UserInputResult;
    if (
      !value ||
      !["answered", "cancelled", "unavailable"].includes(value.outcome) ||
      !Array.isArray(value.request?.questions) ||
      !value.request.questions.every(
        (question) =>
          typeof question.id === "string" &&
          typeof question.text === "string" &&
          (question.options === undefined ||
            (Array.isArray(question.options) &&
              question.options.every(
                (option) => typeof option.id === "string" && typeof option.label === "string",
              ))),
      )
    )
      return;
    if (
      (value.outcome === "answered" || value.answers !== undefined) &&
      (!Array.isArray(value.answers) ||
        !value.answers.every(
          (answer) =>
            typeof answer.questionId === "string" &&
            (answer.type === "skipped" ||
              (answer.type === "text" && typeof answer.text === "string") ||
              (answer.type === "option" && typeof answer.optionId === "string")),
        ))
    )
      return;
    return value;
  } catch {
    return;
  }
};
