import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PermissionPreset } from "../../shared/protocol";
import type { GeneralSettings } from "../../shared/settings";
import { api, command } from "../lib/api";
import { useAsyncAction } from "./useAsyncAction";

export const useGeneralSettings = () => {
  const client = useQueryClient();
  const action = useAsyncAction();
  const query = useQuery({
    queryKey: ["general-settings"],
    queryFn: ({ signal }) => api<GeneralSettings>("/settings/general", { signal }),
    retry: false,
  });
  const save = async (permissionPreset: PermissionPreset): Promise<boolean> => {
    let saved = false;
    await action.run(async () => {
      await client.cancelQueries({ queryKey: ["general-settings"] });
      try {
        const settings = await command<GeneralSettings>(
          "/settings/general",
          { permissionPreset },
          "PUT",
        );
        await client.cancelQueries({ queryKey: ["general-settings"] });
        client.setQueryData(["general-settings"], settings);
        saved = true;
      } catch (error) {
        void client.invalidateQueries({ queryKey: ["general-settings"] });
        throw error;
      }
    });
    return saved;
  };
  return { query, save, pending: action.pending, error: action.error };
};
