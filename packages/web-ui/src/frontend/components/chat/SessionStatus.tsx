import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useSessions } from "../../state/session-store";
import { command } from "../../lib/api";
import { isNothingToCompact } from "../../lib/compaction-notice";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./SessionStatus.css";

export const SessionStatus = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const online = useOnlineStatus();
  const [delayedSession, setDelayedSession] = useState<string>();
  useEffect(() => {
    setDelayedSession(undefined);
    if (connected) return;
    const timer = setTimeout(() => setDelayedSession(snapshot.sessionId), 2_000);
    return () => clearTimeout(timer);
  }, [connected, snapshot.sessionId]);
  const showConnection = !connected && (!online || delayedSession === snapshot.sessionId);
  const error = [
    snapshot.state.canResume ? undefined : snapshot.commandError,
    snapshot.state.canResume ? undefined : snapshot.state.error,
    action.error,
  ].find((candidate) => candidate && !isNothingToCompact(candidate));

  if (!showConnection && !error && !snapshot.state.hasPendingSave) return null;

  return (
    <div className="session-status" role="status">
      {showConnection && (
        <div>
          <span>{t(online ? "reconnecting" : "connectionOffline")}</span>
          <ActionButton
            disabled={!online}
            onClick={() => useSessions.getState().resync(snapshot.sessionId)}
          >
            {t("retry")}
          </ActionButton>
        </div>
      )}
      <ErrorNotice key={snapshot.sessionId} error={error} dismissible />
      {snapshot.state.hasPendingSave && (
        <div>
          {t("pendingSave")}
          <ActionButton
            disabled={action.pending || snapshot.operation !== "idle" || !connected}
            onClick={() =>
              void action.run(() => command("/sessions/" + snapshot.sessionId + "/flush"))
            }
          >
            {t("retrySave")}
          </ActionButton>
        </div>
      )}
    </div>
  );
};
