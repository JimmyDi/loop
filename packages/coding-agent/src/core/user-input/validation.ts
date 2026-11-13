import type { UserInputAnswer, UserInputQuestion } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown, limit: number): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= limit;

const uniqueIds = (values: { id: string }[]) =>
  new Set(values.map(({ id }) => id)).size === values.length;

export const validQuestions = (value: unknown): value is UserInputQuestion[] => {
  if (!Array.isArray(value) || value.length < 1) return false;
  for (const question of value) {
    if (!record(question) || !text(question.id, 80) || !text(question.text, 2000)) return false;
    if (question.options !== undefined) {
      if (!Array.isArray(question.options) || question.options.length < 1) return false;
      if (
        !question.options.every(
          (option) =>
            record(option) &&
            text(option.id, 80) &&
            text(option.label, 300) &&
            (option.description === undefined || text(option.description, 1000)),
        )
      )
        return false;
      if (!uniqueIds(question.options)) return false;
    }
    if (
      question.recommendedOptionId !== undefined &&
      !question.options?.some((option) => option.id === question.recommendedOptionId)
    )
      return false;
  }
  return uniqueIds(value);
};

export const validAnswers = (
  questions: UserInputQuestion[],
  value: unknown,
): value is UserInputAnswer[] => {
  if (!Array.isArray(value) || value.length !== questions.length) return false;
  if (
    new Set(value.map((answer) => (record(answer) ? answer.questionId : undefined))).size !==
    value.length
  )
    return false;
  return questions.every((question) => {
    const answer = value.find(
      (candidate) => record(candidate) && candidate.questionId === question.id,
    );
    if (!record(answer)) return false;
    if (answer.type === "text") return text(answer.text, 10000);
    if (answer.type === "skipped") return true;
    return (
      answer.type === "option" &&
      !!question.options?.some((option) => option.id === answer.optionId)
    );
  });
};
