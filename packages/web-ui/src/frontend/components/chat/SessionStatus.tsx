import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
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
  const error = [snapshot.commandError, snapshot.state.error, action.error].find(
    (candidate) => candidate && !isNothingToCompact(candidate),
  );

  if (connected && !error && !snapshot.state.hasPendingSave) return null;

  return (
    <div className="session-status" role="status">
      {!connected && <span>{t("reconnecting")}</span>}
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
