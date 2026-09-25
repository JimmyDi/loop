import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { command } from "../../lib/api";
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
  const waitingForModel =
    snapshot.operation === "prompt" &&
    !snapshot.state.draft &&
    !Object.values(snapshot.tools).some((tool) => tool.status === "running");

  return (
    <div className="session-status" role="status">
      {!connected && <span>{t("reconnecting")}</span>}
      {connected && (
        <span>
          {t(
            waitingForModel
              ? "waitingForModel"
              : snapshot.operation !== "idle"
                ? "running"
                : snapshot.state.outcome,
          )}
        </span>
      )}
      <ErrorNotice error={snapshot.commandError ?? snapshot.state.error ?? action.error} />
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
