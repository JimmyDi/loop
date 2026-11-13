import { useState } from "react";

import type { UserInputAnswer, UserInputRequest } from "../../shared/protocol";
import { command } from "../lib/api";
import { useSessions } from "../state/session-store";
import { useAsyncAction } from "./useAsyncAction";

const answered = (answer?: UserInputAnswer): boolean =>
  !!answer && (answer.type !== "text" || !!answer.text.trim());

export const useUserInputAnswers = (request: UserInputRequest, connected: boolean) => {
  const action = useAsyncAction();
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserInputAnswer>>(() => {
    const initial: Record<string, UserInputAnswer> = Object.create(null);
    for (const question of request.questions) {
      if (question.options?.[0]) {
        initial[question.id] = {
          questionId: question.id,
          type: "option",
          optionId: question.options[0].id,
        };
      }
    }
    return initial;
  });
  const question = request.questions[page]!;
  const lastPage = page === request.questions.length - 1;
  const disabled = !connected || action.pending;
  const complete = (values: typeof answers) =>
    request.questions.every((item) => answered(values[item.id]));
  const update = (answer: UserInputAnswer) =>
    setAnswers((current) =>
      Object.assign(Object.create(null), current, {
        [answer.questionId]: answer,
      }),
    );
  const selectOption = (optionId: string) => {
    if (disabled || !question.options?.some((option) => option.id === optionId)) return;
    update({ questionId: question.id, type: "option", optionId });
    if (!lastPage) setPage(page + 1);
  };
  const submit = (values: typeof answers) => {
    if (disabled || !complete(values)) return;
    void action.run(async () => {
      try {
        await command("/sessions/" + request.sessionId + "/user-input/" + request.requestId, {
          answers: request.questions.map((item) => values[item.id]),
        });
      } finally {
        useSessions.getState().resync(request.sessionId);
      }
    });
  };
  const advance = () => {
    if (disabled || !answered(answers[question.id])) return;
    if (lastPage) submit(answers);
    else setPage(page + 1);
  };
  const skip = () => {
    if (disabled) return;
    const values = Object.assign(Object.create(null), answers, {
      [question.id]: { questionId: question.id, type: "skipped" },
    });
    setAnswers(values);
    if (!lastPage) setPage(page + 1);
    else if (complete(values)) submit(values);
    else setPage(request.questions.findIndex((item) => !answered(values[item.id])));
  };
  return {
    action,
    answers,
    page,
    setPage,
    question,
    lastPage,
    disabled,
    update,
    selectOption,
    advance,
    skip,
    canAdvance: answered(answers[question.id]) && (!lastPage || complete(answers)),
  };
};
