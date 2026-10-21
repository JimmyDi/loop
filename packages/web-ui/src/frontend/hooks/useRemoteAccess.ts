import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import type { RemoteAccessCommand, RemoteAccessStatus } from "../../shared/remote-access";
import { api, command } from "../lib/api";
import { useAsyncAction } from "./useAsyncAction";

export const useRemoteAccess = () => {
  const client = useQueryClient();
  const action = useAsyncAction();
  const needsCheck = useRef(true);
  const query = useQuery({
    queryKey: ["remote-access"],
    queryFn: async ({ signal }) => {
      const path = needsCheck.current ? "/remote-access?refresh=1" : "/remote-access";
      const status = await api<RemoteAccessStatus>(path, { signal });
      signal.throwIfAborted();
      needsCheck.current = false;
      return status;
    },
    retry: false,
    refetchOnMount: "always",
    refetchInterval: (query) => (query.state.status === "error" ? false : 1500),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const execute = (value: RemoteAccessCommand) =>
    action.run(async () => {
      await client.cancelQueries({ queryKey: ["remote-access"] });
      try {
        const status = await command<RemoteAccessStatus>("/remote-access", { action: value });
        await client.cancelQueries({ queryKey: ["remote-access"] });
        client.setQueryData(["remote-access"], status);
      } finally {
        void client.invalidateQueries({ queryKey: ["remote-access"] });
      }
    });
  return {
    query,
    execute,
    checking: needsCheck.current && query.isFetching,
    pending: action.pending,
    error: action.error,
  };
};
