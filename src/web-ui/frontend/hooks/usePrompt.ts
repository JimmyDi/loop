import { useEffect, useRef, useState } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { api, ApiError, command } from "../lib/api";
import { useRequests } from "../state/request-store";
import { useWorkspace } from "../state/workspace-store";
import { promptContent } from "../../shared/prompt-images";
import type { PromptImage } from "../../shared/prompt-images";

const EMPTY_IMAGES: PromptImage[] = [];

export const usePrompt = (snapshot: SessionSnapshot) => {
  const id = snapshot.sessionId;
  const text = useWorkspace((state) => state.drafts[id] ?? "");
  const request = useRequests((state) => state.pending[id]);
  const draftImages = useWorkspace((state) => state.images[id] ?? EMPTY_IMAGES);
  const images = request?.images ?? draftImages;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const sending = useRef(false);
  const uncertain = !!request && request.requestId !== snapshot.requestId;
  const setText = (value: string) => useWorkspace.getState().draft(id, value);

  const completedText =
    request && snapshot.operation !== "idle" && snapshot.requestId === request.requestId
      ? snapshot.state.messages.some(
          (message) =>
            message.role === "user" &&
            JSON.stringify(message.content) ===
              JSON.stringify(promptContent(request.text, request.images)),
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
    if (
      snapshot.state.outcome === "success" &&
      JSON.stringify(draftImages) === JSON.stringify(request.images ?? [])
    )
      useWorkspace.getState().attach(id, []);
    else if (snapshot.state.outcome !== "success" && request.images?.length && !draftImages.length)
      useWorkspace.getState().attach(id, request.images);
  }, [snapshot, id, request, draftImages]);

  const submit = async (retry = false) => {
    if (sending.current || snapshot.operation !== "idle" || snapshot.state.hasPendingSave) return;

    if (!retry && ((!text.trim() && !images.length) || uncertain)) return;

    sending.current = true;
    setPending(true);
    setError(undefined);
    const next = request ?? {
      requestId: crypto.randomUUID(),
      text,
      streamId: snapshot.streamId,
      ...(images.length ? { images } : {}),
    };

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

      await command("/sessions/" + id + "/prompt", {
        requestId: next.requestId,
        text: next.text,
        images: next.images,
      });
    } catch (error) {
      setError(error);

      if (error instanceof ApiError) {
        if (next.images?.length && !useWorkspace.getState().images[id]?.length)
          useWorkspace.getState().attach(id, next.images);
        useRequests.getState().put(id);
      }
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  return {
    text: completedText ? "" : text,
    images: completedText ? EMPTY_IMAGES : images,
    setText,
    submit,
    pending,
    error,
    uncertain,
  };
};
