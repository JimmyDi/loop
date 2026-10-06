import { useTranslation } from "react-i18next";

import type { McpServerView } from "../../../shared/mcp";
import "./McpSetupStatus.css";

export const McpSetupStatus = ({
  server,
  saving = false,
}: {
  server?: McpServerView;
  saving?: boolean;
}) => {
  const { t } = useTranslation();
  const status = saving ? "saving" : server?.status;
  const checking = saving || ["queued", "connecting", "refreshing"].includes(status ?? "");
  if (!status) return null;
  return (
    <div className="mcp-setup-status" role="status" data-status={status}>
      <div className="mcp-setup-status-heading">
        {checking && <span className="mcp-setup-spinner" aria-hidden="true" />}
        <span>
          {t(saving ? "saving" : "mcp.status." + status)}
          {server && status === "ready" && " · " + t("mcp.toolCount", { count: server.toolCount })}
        </span>
      </div>
      <p>{t(checking ? "mcp.pleaseWait" : "mcp.saved")}</p>
      {!saving && server?.error && (
        <p className="mcp-setup-error">{t("mcp.failure." + server.error)}</p>
      )}
    </div>
  );
};
