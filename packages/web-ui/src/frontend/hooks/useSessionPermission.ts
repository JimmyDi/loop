import type { PermissionPreset, SessionSnapshot } from "../../shared/protocol";
import { command } from "../lib/api";
import { useSessions } from "../state/session-store";
import { useAsyncAction } from "./useAsyncAction";

export const useSessionPermission = (snapshot: SessionSnapshot) => {
  const action = useAsyncAction();
  const change = async (preset: PermissionPreset): Promise<boolean> => {
    let saved = false;
    await action.run(async () => {
      try {
        await command("/sessions/" + snapshot.sessionId + "/permission", { preset }, "PUT");
        saved = true;
      } catch (error) {
        // Refetch through SSE so an uncertain response cannot leave a stale preset.
        useSessions.getState().resync(snapshot.sessionId);
        throw error;
      }
    });
    return saved;
  };
  return { change, pending: action.pending, error: action.error };
};
