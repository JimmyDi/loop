import type { SessionSnapshot } from "../../shared/protocol";
import { command } from "../lib/api";
import { useSessions } from "../state/session-store";
import { useAsyncAction } from "./useAsyncAction";

export const useSessionPlanning = (snapshot: SessionSnapshot) => {
  const action = useAsyncAction();
  const change = (active: boolean) =>
    void action.run(async () => {
      try {
        await command(
          "/sessions/" + snapshot.sessionId + "/mode",
          { mode: active ? "plan" : "execute" },
          "PUT",
        );
      } finally {
        useSessions.getState().resync(snapshot.sessionId);
      }
    });
  return { change, pending: action.pending, error: action.error };
};
