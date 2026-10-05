import { useTranslation } from "react-i18next";

import type { ApprovalRequest } from "../../../shared/protocol";
import { useApprovalDecision } from "../../hooks/useApprovalDecision";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ApprovalDetails } from "./ApprovalDetails";
import "./ApprovalCard.css";

export const ApprovalCard = ({
  request,
  connected,
}: {
  request: ApprovalRequest;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const decision = useApprovalDecision(request);
  const disabled = !connected || decision.pending;
  const operation = request.operation;
  const mode =
    operation?.kind === "shell-unrestricted" ? "danger-full-access" : operation?.permissionMode;

  return (
    <section className="approval-card" aria-label={t("permissions.approvalRequired")}>
      <header className="approval-card-header" role="status">
        <span className="approval-status-dot" aria-hidden="true" />
        {t("permissions.waiting")}
      </header>
      <div className="approval-card-body">
        <p className="approval-summary">
          <strong>
            {mode
              ? t("permissions.allowWithPermissions", { mode })
              : t("permissions.allowOperation")}
            :{" "}
          </strong>
          {request.reason}
        </p>
        {operation?.kind === "shell-unrestricted" && <p>{t("permissions.hostScope")}</p>}
        {!operation && <p>{t("permissions.unknownScope")}</p>}
        {operation && <ApprovalDetails key={request.requestId} operation={operation} />}
      </div>
      <footer className="approval-actions">
        {!connected && <span className="approval-connection">{t("permissions.disconnected")}</span>}
        <ActionButton disabled={disabled} onClick={() => void decision.respond("rejected")}>
          {t("permissions.reject")}
        </ActionButton>
        <ActionButton
          className="approval-allow"
          disabled={disabled}
          onClick={() => void decision.respond("allowed-once")}
        >
          {t("permissions.allowOnce")}
        </ActionButton>
      </footer>
      <ErrorNotice error={decision.error} />
    </section>
  );
};
