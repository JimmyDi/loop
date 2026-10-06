import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { McpServerConfig, McpSettingsView } from "../../shared/mcp";
import { api, command } from "../lib/api";

export const useMcpSettings = () => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["mcp-settings"],
    queryFn: () => api<McpSettingsView>("/settings/mcp"),
    retry: false,
    refetchInterval: (query) => {
      const servers = query.state.data?.servers ?? [];
      if (servers.some((server) => ["queued", "connecting", "refreshing"].includes(server.status)))
        return 1000;
      return servers.some((server) => server.enabled) ? 3000 : false;
    },
  });
  const update = async (path: string, body: unknown, method = "POST") => {
    const view = await command<McpSettingsView>("/settings/mcp" + path, body, method);
    client.setQueryData(["mcp-settings"], view);
    return view;
  };
  return {
    query,
    save: (value: McpServerConfig, existing: boolean) =>
      update(existing ? "/" + value.id : "", value, existing ? "PUT" : "POST"),
    remove: (id: string) => update("/" + id, undefined, "DELETE"),
    toggle: (id: string, enabled: boolean) => update("/" + id + "/enabled", { enabled }, "PATCH"),
    retry: (id: string) => update("/" + id + "/retry", undefined),
  };
};
