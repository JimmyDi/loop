import { useTranslation } from "react-i18next";

import type { McpServerView } from "../../../shared/mcp";
import { McpServerRow } from "./McpServerRow";
import type { McpServerActions } from "./McpServerRow";
import "./McpServerList.css";

export const McpServerList = ({
  servers,
  search,
  loaded,
  ...actions
}: McpServerActions & {
  servers: McpServerView[];
  search: string;
  loaded: boolean;
}) => {
  const { t } = useTranslation();
  const visible = servers.filter((server) =>
    server.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="mcp-server-list plugin-list">
      <h4>{t("mcp.servers")}</h4>
      {loaded && !servers.length && <p className="plugin-list-empty">{t("mcp.empty")}</p>}
      {visible.map((server) => (
        <McpServerRow key={server.id} server={server} {...actions} />
      ))}
      {!!servers.length && !visible.length && (
        <p className="plugin-list-empty">{t("mcp.noResults")}</p>
      )}
    </div>
  );
};
