import { useTranslation } from "react-i18next";

import type { UserInputResult } from "../../../shared/protocol";
import "./UserInputHistory.css";

export const UserInputHistory = ({ result }: { result: UserInputResult }) => {
  const { t } = useTranslation();
  return (
    <details className="user-input-history">
      <summary>
        {t(
          result.outcome === "answered"
            ? "answeredQuestions"
            : result.outcome === "cancelled"
              ? "cancelledQuestions"
              : "unavailableQuestions",
        )}
      </summary>
      {result.request.questions.map((question) => {
        const answer = result.answers?.find((item) => item.questionId === question.id);
        const text =
          answer?.type === "text"
            ? answer.text
            : answer?.type === "option"
              ? question.options?.find((option) => option.id === answer.optionId)?.label
              : answer?.type === "skipped"
                ? t("skipAnswer")
                : undefined;
        return (
          <div key={question.id}>
            <strong>{question.text}</strong>
            {text && <p>{text}</p>}
          </div>
        );
      })}
    </details>
  );
};
