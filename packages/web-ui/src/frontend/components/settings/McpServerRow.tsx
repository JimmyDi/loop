import { useTranslation } from "react-i18next";

import type { McpServerView } from "../../../shared/mcp";
import { ActionButton } from "../ui/ActionButton";
import { SettingsIcon } from "../ui/SettingsIcon";
import "./McpServerRow.css";

export type McpServerActions = {
  pending: boolean;
  onEdit(server: McpServerView): void;
  onRetry(id: string): void;
  onToggle(id: string, enabled: boolean): void;
};

export const McpServerRow = ({
  server,
  pending,
  onEdit,
  onRetry,
  onToggle,
}: McpServerActions & { server: McpServerView }) => {
  const { t } = useTranslation();
  return (
    <div className="mcp-server-row">
      <div className="mcp-server-identity">
        <span className="mcp-server-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {server.transport === "stdio" ? (
              <>
                <rect x="3" y="4" width="18" height="16" rx="4" />
                <path d="m7 9 3 3-3 3m6 0h4" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <ellipse cx="12" cy="12" rx="4" ry="9" />
                <path d="M3 12h18" />
              </>
            )}
          </svg>
        </span>
        <div>
          <strong>{server.name}</strong>
          <div className="mcp-server-meta">
            <span className="mcp-server-transport">
              {server.transport === "stdio" ? "STDIO" : "Streamable HTTP"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="mcp-server-status" data-status={server.status}>
              {t("mcp.status." + server.status)}
              {server.status === "ready" && " · " + t("mcp.toolCount", { count: server.toolCount })}
            </span>
          </div>
          {server.error && <p className="mcp-server-error">{t("mcp.failure." + server.error)}</p>}
        </div>
      </div>
      <div className="mcp-server-actions">
        {server.status === "error" && (
          <ActionButton className="ghost" disabled={pending} onClick={() => onRetry(server.id)}>
            {t("retry")}
          </ActionButton>
        )}
        <ActionButton
          className="ghost icon"
          disabled={pending}
          aria-label={t("mcp.configure", { name: server.name })}
          onClick={() => onEdit(server)}
        >
          <SettingsIcon />
        </ActionButton>
        <button
          type="button"
          className="mcp-switch"
          role="switch"
          aria-label={t("mcp.enable", { name: server.name })}
          aria-checked={server.enabled}
          disabled={pending}
          onClick={() => onToggle(server.id, !server.enabled)}
        >
          <span />
        </button>
      </div>
    </div>
  );
};
