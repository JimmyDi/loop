import { useQueryClient } from "@tanstack/react-query";

import type { ModelSelection, SessionSnapshot } from "../../shared/protocol";
import { command } from "../lib/api";
import { useAsyncAction } from "./useAsyncAction";

export const useModelSelection = (snapshot: SessionSnapshot) => {
  const client = useQueryClient();
  const action = useAsyncAction();
  const change = async (choice: ModelSelection): Promise<boolean> => {
    let saved = false;
    await action.run(async () => {
      const next = await command<SessionSnapshot>(
        "/sessions/" + snapshot.sessionId + "/model",
        choice,
        "PUT",
      );
      client.setQueryData(["session", snapshot.sessionId], next);
      saved = true;
    });
    return saved;
  };
  return { change, pending: action.pending, error: action.error };
};
