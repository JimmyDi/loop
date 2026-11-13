import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { UserInputAnswer, UserInputRequest } from "../../../shared/protocol";
import { useUserInputAnswers } from "../../hooks/useUserInputAnswers";
import { command } from "../../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./UserInputCard.css";

export const UserInputCard = ({
  request,
  connected,
}: {
  request: UserInputRequest;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const {
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
    canAdvance,
  } = useUserInputAnswers(request, connected);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!connected || question.options || window.matchMedia("(pointer: coarse)").matches) return;
    input.current?.focus({ preventScroll: true });
  }, [question, connected]);

  return (
    <form
      className="user-input-card"
      aria-label={t("waitingForAnswer")}
      onSubmit={(event) => {
        event.preventDefault();
        advance();
      }}
    >
      <div className="user-input-header">
        <span className="user-input-heading" role="status" aria-label={t("waitingForAnswer")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 19 4 21l1-5a8 8 0 1 1 3 3Z" />
            <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 16h.01" />
          </svg>
          {t("questionHeading")}
        </span>
        <div className="user-input-navigation">
          {request.questions.length > 1 && (
            <>
              <ActionButton
                className="user-input-page"
                aria-label={t("previousQuestion")}
                disabled={disabled || page === 0}
                onClick={() => setPage(page - 1)}
              >
                ‹
              </ActionButton>
              <span className="user-input-progress" aria-live="polite">
                {t("questionProgress", { current: page + 1, total: request.questions.length })}
              </span>
              <ActionButton
                className="user-input-page"
                aria-label={t("nextQuestionPage")}
                disabled={disabled || lastPage}
                onClick={() => setPage(page + 1)}
              >
                ›
              </ActionButton>
            </>
          )}
          <ActionButton
            className="user-input-close"
            aria-label={t("stop")}
            title={t("stop")}
            disabled={disabled}
            onClick={() =>
              void action.run(() => command("/sessions/" + request.sessionId + "/abort"))
            }
          >
            <span aria-hidden="true">×</span>
          </ActionButton>
        </div>
      </div>
      {request.questions.slice(page, page + 1).map((question) => (
        <fieldset key={question.id} disabled={disabled}>
          <legend>{question.text}</legend>
          {question.options?.map((option, index) => (
            <label className="user-input-option" key={option.id}>
              <input
                type="radio"
                aria-label={option.label}
                name={request.requestId + question.id}
                checked={
                  answers[question.id]?.type === "option" &&
                  (answers[question.id] as Extract<UserInputAnswer, { type: "option" }>)
                    .optionId === option.id
                }
                onChange={() => selectOption(option.id)}
                onClick={() => {
                  const answer = answers[question.id];
                  if (answer?.type === "option" && answer.optionId === option.id) {
                    selectOption(option.id);
                  }
                }}
              />
              <span className="user-input-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="user-input-option-text">
                {option.label}
                {option.id === question.recommendedOptionId && (
                  <small> · {t("recommendedAnswer")}</small>
                )}
                {option.description && (
                  <span className="user-input-description">{option.description}</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      <ErrorNotice error={action.error} />
      <div className="user-input-footer" data-choice={!!question.options}>
        <div className="user-input-custom" data-choice={!!question.options}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5 4 4M4 20l5-1L20 8a3 3 0 0 0-4-4L5 15l-1 5Z" />
          </svg>
          <textarea
            key={question.id}
            ref={input}
            disabled={disabled}
            rows={1}
            aria-label={question.text}
            placeholder={t(question.options ? "customAnswer" : "questionReply")}
            maxLength={10000}
            value={
              answers[question.id]?.type === "text"
                ? (answers[question.id] as Extract<UserInputAnswer, { type: "text" }>).text
                : ""
            }
            onChange={(event) =>
              update({ questionId: question.id, type: "text", text: event.target.value })
            }
          />
        </div>
        <div className="user-input-actions">
          <ActionButton disabled={disabled} onClick={skip}>
            {t("skipAnswer")}
          </ActionButton>
          <ActionButton
            className="user-input-send"
            type="submit"
            disabled={disabled || !canAdvance}
          >
            {t(action.pending ? "submittingAnswer" : lastPage ? "submitAnswer" : "nextQuestion")}
          </ActionButton>
        </div>
      </div>
    </form>
  );
};
