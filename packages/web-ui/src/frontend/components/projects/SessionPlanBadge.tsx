import { useTranslation } from "react-i18next";

import type { SessionSnapshot, SessionSummary } from "../../../shared/protocol";
import "./SessionPlanBadge.css";

export const SessionPlanBadge = ({
  session,
  snapshot,
}: {
  session: SessionSummary;
  snapshot?: SessionSnapshot;
}) => {
  const { t } = useTranslation();
  const planning = snapshot
    ? snapshot.operation === "prompt" && snapshot.state.planning?.mode === "plan"
    : session.isPlanning;
  const ready = snapshot
    ? snapshot.operation === "idle" &&
      snapshot.state.planning?.mode === "plan" &&
      snapshot.state.planning.plans.at(-1)?.status === "ready"
    : session.isPlanReady;
  return planning || ready ? (
    <span className="session-plan-badge" data-ready={!!ready} role="status">
      {t(planning ? "planning" : "planReady")}
    </span>
  ) : null;
};
