import { useTranslation } from "react-i18next";

import type { SessionSnapshot, SessionSummary } from "../../../shared/protocol";
import { SessionPlanBadge } from "./SessionPlanBadge";
import "./SessionActivity.css";

export const SessionActivity = ({
  session,
  snapshot,
  waiting,
  generating,
}: {
  session: SessionSummary;
  snapshot?: SessionSnapshot;
  waiting: boolean;
  generating: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <>
      {!waiting && <SessionPlanBadge session={session} snapshot={snapshot} />}
      {generating && !waiting && snapshot?.state.planning?.mode !== "plan" && (
        <span
          className="session-list-spinner"
          role="img"
          aria-label={t("looping", "Looping...")}
          title={t("looping", "Looping...")}
        />
      )}
    </>
  );
};
