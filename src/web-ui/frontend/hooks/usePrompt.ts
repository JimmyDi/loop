import { useEffect, useRef, useState } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { api, ApiError, command } from "../lib/api";
import { useRequests } from "../state/request-store";
import { useWorkspace } from "../state/workspace-store";

export const usePrompt = (snapshot: SessionSnapshot) => {
  const id = snapshot.sessionId;
  const text = useWorkspace((state) => state.drafts[id] ?? "");
  const request = useRequests((state) => state.pending[id]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const sending = useRef(false);
  const uncertain = !!request && request.requestId !== snapshot.requestId;
  const setText = (value: string) => useWorkspace.getState().draft(id, value);

  const completedText =
    request && snapshot.operation !== "idle" && snapshot.requestId === request.requestId
      ? snapshot.state.messages.some(
          (message) => message.role === "user" && message.content === request.text,
        )
      : false;

  useEffect(() => {
    if (!request || snapshot.requestId !== request.requestId || snapshot.operation !== "idle")
      return;

    if (
      snapshot.state.outcome === "success" &&
      useWorkspace.getState().drafts[id] === request.text
    ) {
      useWorkspace.getState().draft(id, "");
    }

    useRequests.getState().put(id);
  }, [snapshot, id, request]);

  const submit = async (retry = false) => {
    if (sending.current || snapshot.operation !== "idle" || snapshot.state.hasPendingSave) return;

    if (!retry && (!text.trim() || uncertain)) return;

    sending.current = true;
    setPending(true);
    setError(undefined);
    const next = request ?? { requestId: crypto.randomUUID(), text, streamId: snapshot.streamId };

    useRequests.getState().put(id, next);

    try {
      if (retry) {
        const current = await api<SessionSnapshot>("/sessions/" + id);

        if (current.requestId === next.requestId) return;

        if (current.streamId !== next.streamId) {
          throw new ApiError(
            "delivery_unknown",
            "Server restarted; inspect history before sending again.",
            409,
          );
        }
      }

      await command("/sessions/" + id + "/prompt", { requestId: next.requestId, text: next.text });
    } catch (error) {
      setError(error);

      if (error instanceof ApiError) useRequests.getState().put(id);
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  return { text: completedText ? "" : text, setText, submit, pending, error, uncertain };
};
