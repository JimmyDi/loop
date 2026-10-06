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
  const pending = (snapshot.state.pendingApprovals ?? []).filter(
    (request) => request.sessionId === snapshot.sessionId,
  );
  if (!pending.length) return null;
  return (
    <div className="session-approvals">
      {pending.map((request) => (
        <ApprovalCard
          key={request.sessionId + request.requestId}
          request={request}
          connected={connected}
        />
      ))}
    </div>
  );
};
