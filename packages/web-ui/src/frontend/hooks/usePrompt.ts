import { useEffect, useState } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { api, ApiError, command } from "../lib/api";
import { useRequests } from "../state/request-store";
import { useWorkspace } from "../state/workspace-store";
import { promptContent } from "../../shared/prompt-images";
import type { PromptImage } from "../../shared/prompt-images";
import type { PromptFile } from "../../shared/prompt-files";

const EMPTY_IMAGES: PromptImage[] = [];
const EMPTY_FILES: PromptFile[] = [];

export const usePrompt = (snapshot: SessionSnapshot, hasProject = true) => {
  const id = snapshot.sessionId;
  const text = useWorkspace((state) => state.drafts[id] ?? "");
  const request = useRequests((state) => state.pending[id]);
  const delivery = useRequests((state) => state.delivery[id]);
  const draftImages = useWorkspace((state) => state.images[id] ?? EMPTY_IMAGES);
  const images = request ? (request.images ?? EMPTY_IMAGES) : draftImages;
  const draftFiles = useWorkspace((state) => state.files[id] ?? EMPTY_FILES);
  const files = request ? (request.files ?? EMPTY_FILES) : draftFiles;
  const [error, setError] = useState<unknown>();
  const unconfirmed = !!request && request.requestId !== snapshot.requestId;
  const pending =
    !!request &&
    (delivery === "sending" ||
      (delivery === "accepted" && unconfirmed && request.streamId === snapshot.streamId));
  const uncertain = unconfirmed && !pending;
  const setText = (value: string) => useWorkspace.getState().draft(id, value);

  const completedText =
    request && snapshot.operation !== "idle" && snapshot.requestId === request.requestId
      ? snapshot.state.messages.some(
          (message) =>
            message.role === "user" &&
            JSON.stringify(message.content) ===
              JSON.stringify(promptContent(request.text, request.images, request.files)),
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
    if (
      snapshot.state.outcome === "success" &&
      JSON.stringify(draftFiles) === JSON.stringify(request.files ?? [])
    )
      useWorkspace.getState().attachFiles(id, []);
    else if (snapshot.state.outcome !== "success" && request.files?.length && !draftFiles.length)
      useWorkspace.getState().attachFiles(id, request.files);
  }, [snapshot, id, request, draftImages, draftFiles]);

  const submit = async (retry = false) => {
    const current = useRequests.getState();
    const request = current.pending[id];
    if (!hasProject || snapshot.operation !== "idle" || snapshot.state.hasPendingSave) return;
    if (
      request &&
      (current.delivery[id] === "sending" ||
        (current.delivery[id] === "accepted" && request.streamId === snapshot.streamId))
    )
      return;

    if (retry ? !request : request || (!text.trim() && !images.length && !files.length)) return;

    setError(undefined);
    const next = request ?? {
      requestId: crypto.randomUUID(),
      text,
      streamId: snapshot.streamId,
      ...(images.length ? { images } : {}),
      ...(files.length ? { files } : {}),
    };

    useRequests.getState().put(id, next, "sending");

    try {
      if (retry) {
        const current = await api<SessionSnapshot>("/sessions/" + id);

        if (current.requestId === next.requestId) {
          useRequests.getState().markDelivery(id, next.requestId, "accepted");
          return;
        }

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
        files: next.files,
      });
      useRequests.getState().markDelivery(id, next.requestId, "accepted");
    } catch (error) {
      if (useRequests.getState().pending[id]?.requestId !== next.requestId) return;

      setError(error);

      if (error instanceof ApiError) {
        if (next.images?.length && !useWorkspace.getState().images[id]?.length)
          useWorkspace.getState().attach(id, next.images);
        if (next.files?.length && !useWorkspace.getState().files[id]?.length)
          useWorkspace.getState().attachFiles(id, next.files);
        useRequests.getState().put(id);
      } else {
        useRequests.getState().markDelivery(id, next.requestId);
      }
    }
  };

  return {
    text: completedText ? "" : text,
    images: completedText ? EMPTY_IMAGES : images,
    files: completedText ? EMPTY_FILES : files,
    setText,
    submit,
    pending,
    error,
    uncertain,
  };
};
