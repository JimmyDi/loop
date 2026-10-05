import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { ApprovalCard } from "./ApprovalCard";
import "./SessionApprovals.css";

export const SessionApprovals = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const pending = (snapshot.state.pendingApprovals ?? []).filter(
    (request) => request.sessionId === snapshot.sessionId,
  );
  const result = snapshot.lastApproval;
  if (!pending.length && !result) return null;
  return (
    <div className="session-approvals">
      {pending.map((request) => (
        <ApprovalCard
          key={request.sessionId + request.requestId}
          request={request}
          connected={connected}
        />
      ))}
      {!pending.length && result?.request.sessionId === snapshot.sessionId && (
        <p className="approval-outcome" role="status">
          {result.request.toolName}: {t(`permissions.outcomes.${result.outcome}`)}
        </p>
      )}
    </div>
  );
};
