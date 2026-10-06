import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { McpServerConfig, McpServerView, McpValue } from "../../../shared/mcp";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SettingsField } from "../ui/SettingsField";
import { McpTransportFields } from "./McpTransportFields";
import { McpSetupStatus } from "./McpSetupStatus";
import "./McpForm.css";

export const McpForm = ({
  initial,
  existing,
  server,
  save,
  onBack,
  remove,
}: {
  initial: McpServerConfig;
  existing: boolean;
  server?: McpServerView;
  save(value: McpServerConfig): Promise<void>;
  onBack(): void;
  remove(): Promise<void>;
}) => {
  const { t } = useTranslation();
  const [stdio, setStdio] = useState<McpServerConfig & { transport: "stdio" }>(
    initial.transport === "stdio"
      ? initial
      : {
          id: initial.id,
          name: initial.name,
          enabled: initial.enabled,
          transport: "stdio",
          command: "",
          args: [],
          env: [],
          envVars: [],
          cwd: "",
        },
  );
  const [http, setHttp] = useState<McpServerConfig & { transport: "http" }>(
    initial.transport === "http"
      ? initial
      : {
          id: initial.id,
          name: initial.name,
          enabled: initial.enabled,
          transport: "http",
          url: "",
          bearerTokenEnv: "",
          headers: [],
          envHeaders: [],
        },
  );
  const [transport, setTransport] = useState(initial.transport);
  const [name, setName] = useState(initial.name);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const action = useAsyncAction();
  const checking = Boolean(
    server && ["queued", "connecting", "refreshing"].includes(server.status),
  );
  const value = transport === "stdio" ? stdio : http;
  const filledRows = (rows: McpValue[]) => rows.filter((row) => row.key || row.value || row.saved);
  const submitValue: McpServerConfig =
    value.transport === "stdio"
      ? {
          id: value.id,
          name,
          enabled: value.enabled,
          transport: value.transport,
          command: value.command,
          args: value.args,
          env: filledRows(value.env),
          envVars: value.envVars.filter(Boolean),
          cwd: value.cwd,
        }
      : {
          id: value.id,
          name,
          enabled: value.enabled,
          transport: value.transport,
          url: value.url,
          bearerTokenEnv: value.bearerTokenEnv,
          headers: filledRows(value.headers),
          envHeaders: filledRows(value.envHeaders),
        };
  return (
    <form
      className="mcp-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (checking) return;
        void action.run(async () => {
          setSaving(true);
          try {
            await save({ ...submitValue, name: name.trim() });
          } finally {
            setSaving(false);
          }
          const redactedRows = (rows: McpValue[]) =>
            rows.map((row) => ({ key: row.key, value: "", saved: true }));
          if (submitValue.transport === "stdio")
            setStdio({ ...submitValue, env: redactedRows(submitValue.env) });
          else setHttp({ ...submitValue, headers: redactedRows(submitValue.headers) });
        });
      }}
    >
      <div className="mcp-form-heading">
        <ActionButton className="ghost" disabled={action.pending} onClick={onBack}>
          ← {t("mcp.back")}
        </ActionButton>
        <h3>{t(existing ? "mcp.edit" : "mcp.addServer")}</h3>
      </div>
      <div className="mcp-form-body" aria-busy={saving || checking}>
        <fieldset disabled={action.pending || checking}>
          <div className="mcp-connection-card">
            <SettingsField
              label={t("mcp.name")}
              required
              maxLength={100}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="mcp-connection-type">
              <span>{t("mcp.transport")}</span>
              <div className="mcp-transport-toggle" role="group" aria-label={t("mcp.transport")}>
                <ActionButton
                  aria-pressed={transport === "stdio"}
                  onClick={() => setTransport("stdio")}
                >
                  STDIO
                </ActionButton>
                <ActionButton
                  aria-pressed={transport === "http"}
                  onClick={() => setTransport("http")}
                >
                  Streamable HTTP
                </ActionButton>
              </div>
            </div>
          </div>
          <McpTransportFields
            value={value}
            onChange={(config) =>
              config.transport === "stdio" ? setStdio(config) : setHttp(config)
            }
          />
          <p className="mcp-storage-hint">{t("mcp.storage")}</p>
          <ErrorNotice error={action.error} />
          {server && !saving && !checking && <McpSetupStatus server={server} />}
          {deleting && (
            <div className="mcp-delete-confirm">
              <p>{t("mcp.deleteConfirm", { name: initial.name })}</p>
              <ActionButton onClick={() => void action.run(remove)}>{t("delete")}</ActionButton>
              <ActionButton onClick={() => setDeleting(false)}>{t("cancel")}</ActionButton>
            </div>
          )}
          <div className="mcp-form-actions">
            {existing && (
              <ActionButton className="ghost" onClick={() => setDeleting(true)}>
                {t("delete")}
              </ActionButton>
            )}
            <ActionButton className="primary" type="submit" disabled={action.pending || checking}>
              {t(action.pending ? "saving" : checking ? "mcp.checking" : "save")}
            </ActionButton>
          </div>
        </fieldset>
        {(saving || checking) && (
          <div className="mcp-form-overlay">
            <McpSetupStatus server={server} saving={saving} />
          </div>
        )}
      </div>
    </form>
  );
};
