import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { McpServerConfig } from "../../../shared/mcp";
import { useMcpSettings } from "../../hooks/useMcpSettings";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { McpForm } from "./McpForm";
import { McpAddMenu } from "./McpAddMenu";
import { McpToolbar } from "./McpToolbar";
import { McpServerList } from "./McpServerList";
import "./PluginsSettings.css";

export const PluginsSettings = () => {
  const { t } = useTranslation();
  const { query, save, remove, toggle, retry } = useMcpSettings();
  const [editing, setEditing] = useState<{
    value: McpServerConfig;
    existing: boolean;
    saved?: boolean;
  }>();
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (page.current?.parentElement) page.current.parentElement.scrollTop = 0;
  }, [editing?.value.id]);
  const [search, setSearch] = useState("");
  const action = useAsyncAction();
  const servers = query.data?.servers ?? [];
  const savedServer = editing?.saved
    ? servers.find((server) => server.id === editing.value.id)
    : undefined;
  useEffect(() => {
    if (savedServer?.status === "ready" || savedServer?.status === "disabled")
      setEditing(undefined);
  }, [savedServer?.status]);
  const add = () => {
    action.clearError();
    setEditing({
      existing: false,
      value: {
        id: crypto.randomUUID(),
        name: "",
        enabled: true,
        transport: "stdio",
        command: "",
        args: [],
        env: [],
        envVars: [],
        cwd: "",
      },
    });
  };
  return (
    <div className="plugins-settings" ref={page}>
      <div className="plugins-heading">
        <div>
          <h3>{t("plugins")}</h3>
          <p>{t("mcp.description")}</p>
        </div>
        <McpAddMenu onAdd={add} disabled={Boolean(editing)} />
      </div>
      <McpToolbar count={servers.length} search={search} onSearch={setSearch} />
      <ErrorNotice error={query.error ?? action.error} />
      {query.isError && (
        <ActionButton onClick={() => void query.refetch()}>{t("retry")}</ActionButton>
      )}
      {query.isPending && <p role="status">{t("loading")}</p>}
      {editing ? (
        <McpForm
          initial={editing.value}
          existing={editing.existing}
          server={savedServer}
          onBack={() => setEditing(undefined)}
          save={async (value) => {
            const view = await save(value, editing.existing);
            const saved = view.servers.find((server) => server.id === value.id);
            if (saved) setEditing({ value: saved, existing: true, saved: true });
          }}
          remove={async () => {
            await remove(editing.value.id);
            setEditing(undefined);
          }}
        />
      ) : (
        <McpServerList
          servers={servers}
          search={search}
          loaded={query.isSuccess}
          pending={action.pending}
          onEdit={(server) => {
            action.clearError();
            setEditing({ value: server, existing: true });
          }}
          onRetry={(id) => void action.run(() => retry(id))}
          onToggle={(id, enabled) => void action.run(() => toggle(id, enabled))}
        />
      )}
    </div>
  );
};
