import { useEffect, useState } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { command } from "../lib/api";
import { isNothingToCompact } from "../lib/compaction-notice";
import { useSessions } from "../state/session-store";
import { useWorkspace } from "../state/workspace-store";
import { useAsyncAction } from "./useAsyncAction";

/** Host command: never submit command text as a model prompt. */
export const useContextCompaction = (snapshot: SessionSnapshot, connected: boolean) => {
  const action = useAsyncAction();
  const [noWork, setNoWork] = useState<string>();
  const revision = JSON.stringify([
    snapshot.sessionId,
    snapshot.state.messages.length,
    snapshot.state.compaction?.id,
    snapshot.model.provider,
    snapshot.model.id,
  ]);
  useEffect(() => {
    if (
      isNothingToCompact(action.error) &&
      (noWork !== revision || (snapshot.operation !== "idle" && snapshot.operation !== "compact"))
    )
      action.clearError();
  }, [revision, noWork, snapshot.operation, action.error, action.clearError]);
  const available =
    snapshot.state.compactionAvailable ??
    snapshot.state.messages
      .slice(snapshot.state.compaction?.firstKeptMessageIndex ?? 0)
      .filter((message) => message.role === "user").length >= 2;
  const running = snapshot.operation === "compact" || action.pending;
  const disabled =
    !available ||
    noWork === revision ||
    !connected ||
    running ||
    snapshot.operation !== "idle" ||
    snapshot.state.hasPendingSave ||
    !!snapshot.state.pendingApprovals?.length;
  const start = async (): Promise<boolean> => {
    if (disabled) return false;
    const text = useWorkspace.getState().drafts[snapshot.sessionId];
    let saved = false;
    await action.run(async () => {
      try {
        await command("/sessions/" + snapshot.sessionId + "/compact");
        saved = true;
        if (
          text &&
          /^\s*\/[a-z]*\s*$/i.test(text) &&
          useWorkspace.getState().drafts[snapshot.sessionId] === text
        )
          useWorkspace.getState().draft(snapshot.sessionId, "");
      } catch (error) {
        if (isNothingToCompact(error)) setNoWork(revision);
        else useSessions.getState().resync(snapshot.sessionId);
        throw error;
      }
    });
    return saved;
  };
  return { start, running, disabled, error: action.error };
};
