import type { ApprovalDecision, ApprovalRequest } from "../../shared/protocol";
import { command } from "../lib/api";
import { useSessions } from "../state/session-store";
import { useAsyncAction } from "./useAsyncAction";

export const useApprovalDecision = (request: ApprovalRequest) => {
  const action = useAsyncAction();
  const respond = (decision: ApprovalDecision) =>
    action.run(async () => {
      try {
        await command(
          "/sessions/" +
            encodeURIComponent(request.sessionId) +
            "/approvals/" +
            encodeURIComponent(request.requestId),
          { decision },
        );
      } catch (error) {
        // Refresh rather than retrying an uncertain allow-once response.
        useSessions.getState().resync(request.sessionId);
        throw error;
      }
    });
  return { respond, pending: action.pending, error: action.error };
};
