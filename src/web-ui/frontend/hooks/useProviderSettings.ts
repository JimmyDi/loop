import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProviderConfig, ProvidersView } from "../../shared/provider";
import { api, command } from "../lib/api";

export const useProviderSettings = () => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["provider-settings"],
    queryFn: () => api<ProvidersView>("/settings/providers"),
    retry: false,
  });
  const update = async (path: string, input: ProviderConfig | undefined, method: string) => {
    const value = await command<ProvidersView>(path, input, method);
    client.setQueryData(["provider-settings"], value);
    await client.invalidateQueries({ queryKey: ["models"] });
  };
  const save = (input: ProviderConfig, existing: boolean) =>
    update(
      "/settings/providers" + (existing ? "/" + input.id : ""),
      input,
      existing ? "PUT" : "POST",
    );
  const remove = (id: string) => update("/settings/providers/" + id, undefined, "DELETE");
  return { query, save, remove };
};
