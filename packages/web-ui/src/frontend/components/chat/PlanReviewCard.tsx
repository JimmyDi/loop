import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePrompt } from "../../hooks/usePrompt";
import { command } from "../../lib/api";
import { useSessions } from "../../state/session-store";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./PlanReviewCard.css";

export const PlanReviewCard = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const prompt = usePrompt(snapshot);
  const [feedback, setFeedback] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const plan = snapshot.state.planning?.plans.at(-1);
  const blocked =
    !connected ||
    snapshot.state.isRunning ||
    snapshot.operation !== "idle" ||
    snapshot.state.hasPendingSave ||
    action.pending ||
    prompt.pending ||
    prompt.uncertain ||
    !!snapshot.state.queue?.length ||
    !!snapshot.state.pendingApprovals?.length ||
    !!snapshot.state.pendingUserInputs?.length;
  if (dismissed || snapshot.state.planning?.mode !== "plan" || plan?.status !== "ready")
    return null;

  const submitFeedback = async () => {
    if (blocked || !feedback.trim()) return;
    const result = await prompt.submitText(feedback.trim());
    if (result === "accepted") setDismissed(true);
  };
  const skip = () => {
    if (blocked) return;
    void action.run(async () => {
      try {
        await command("/sessions/" + snapshot.sessionId + "/skip-plan", {
          id: plan.id,
          version: plan.version,
        });
        setDismissed(true);
      } finally {
        useSessions.getState().resync(snapshot.sessionId);
      }
    });
  };
  return (
    <form
      className="plan-review-card"
      aria-label={t("implementPlanQuestion")}
      onSubmit={(event) => {
        event.preventDefault();
        void submitFeedback();
      }}
    >
      <div className="plan-review-header">
        <span>{t("implementPlanQuestion")}</span>
        <button
          type="button"
          className="plan-review-close"
          aria-label={t("skipPlanReview")}
          disabled={blocked}
          onClick={skip}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <button
        type="button"
        className="plan-review-implement"
        disabled={blocked}
        onClick={() => {
          if (blocked) return;
          void action.run(async () => {
            try {
              await command("/sessions/" + snapshot.sessionId + "/execute-plan", {
                id: plan.id,
                version: plan.version,
              });
              setDismissed(true);
            } finally {
              useSessions.getState().resync(snapshot.sessionId);
            }
          });
        }}
      >
        <span className="plan-review-choice" aria-hidden="true" />
        <span>{t("implementPlanOption")}</span>
        <span className="plan-review-arrow" aria-hidden="true">
          →
        </span>
      </button>
      <div className="plan-review-footer">
        <div className="plan-review-feedback">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5 4 4M4 20l5-1L20 8a3 3 0 0 0-4-4L5 15l-1 5Z" />
          </svg>
          <textarea
            rows={1}
            aria-label={t("planFeedback")}
            placeholder={t("planFeedback")}
            maxLength={10000}
            value={feedback}
            disabled={blocked}
            onChange={(event) => setFeedback(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submitFeedback();
              }
            }}
          />
        </div>
        <button type="button" disabled={blocked} onClick={skip}>
          {t("skipAnswer")}
        </button>
        {!!feedback.trim() && (
          <button type="submit" disabled={blocked} className="plan-review-send">
            {t("submitAnswer")}
          </button>
        )}
      </div>
      <ErrorNotice error={action.error ?? prompt.error} />
    </form>
  );
};
