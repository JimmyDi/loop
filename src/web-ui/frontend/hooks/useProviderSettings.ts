import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProviderInput, ProviderView } from "../../shared/provider";
import { api, command } from "../lib/api";

export const useProviderSettings = () => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["provider-settings"],
    queryFn: () => api<ProviderView | null>("/settings/provider"),
    retry: false,
  });
  const save = async (input: ProviderInput) => {
    const value = await command<ProviderView>("/settings/provider", input, "PUT");

    client.setQueryData(["provider-settings"], value);
    await client.invalidateQueries({ queryKey: ["models"] });
  };

  return { query, save };
};
