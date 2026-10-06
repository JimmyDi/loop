import { useTranslation } from "react-i18next";

import type { McpServerConfig } from "../../../shared/mcp";
import { SettingsField } from "../ui/SettingsField";
import { McpRows } from "./McpRows";
import "./McpTransportFields.css";

export const McpTransportFields = ({
  value,
  onChange,
}: {
  value: McpServerConfig;
  onChange(value: McpServerConfig): void;
}) => {
  const { t } = useTranslation();
  if (value.transport === "stdio")
    return (
      <div className="mcp-transport-fields">
        <SettingsField
          label={t("mcp.command")}
          placeholder="npx"
          required
          value={value.command}
          onChange={(event) => onChange({ ...value, command: event.target.value })}
        />
        <McpRows
          label={t("mcp.args")}
          rows={value.args.map((item) => ({ key: "", value: item }))}
          onChange={(rows) => onChange({ ...value, args: rows.map((row) => row.value) })}
        />
        <McpRows
          label={t("mcp.env")}
          pair
          secret
          rows={value.env}
          onChange={(env) => onChange({ ...value, env })}
        />
        <McpRows
          label={t("mcp.envVars")}
          valueLabel={t("mcp.envName")}
          rows={value.envVars.map((item) => ({ key: "", value: item }))}
          onChange={(rows) => onChange({ ...value, envVars: rows.map((row) => row.value) })}
        />
        <SettingsField
          label={t("mcp.cwd")}
          placeholder={t("mcp.cwdPlaceholder")}
          value={value.cwd}
          onChange={(event) => onChange({ ...value, cwd: event.target.value })}
        />
      </div>
    );
  return (
    <div className="mcp-transport-fields">
      <SettingsField
        label={t("mcp.url")}
        type="url"
        required
        placeholder="https://example.com/mcp"
        value={value.url}
        onChange={(event) => onChange({ ...value, url: event.target.value })}
      />
      <SettingsField
        label={t("mcp.bearer")}
        placeholder="MCP_TOKEN"
        hint={t("mcp.envHint")}
        value={value.bearerTokenEnv}
        onChange={(event) => onChange({ ...value, bearerTokenEnv: event.target.value })}
      />
      <McpRows
        label={t("mcp.headers")}
        pair
        secret
        rows={value.headers}
        onChange={(headers) => onChange({ ...value, headers })}
      />
      <McpRows
        label={t("mcp.envHeaders")}
        pair
        valueLabel={t("mcp.envName")}
        rows={value.envHeaders}
        onChange={(envHeaders) => onChange({ ...value, envHeaders })}
      />
    </div>
  );
};
