import { useEffect, useState } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { api, ApiError, command } from "../lib/api";
import { useRequests } from "../state/request-store";
import type { PendingRequest } from "../state/request-store";
import { useWorkspace } from "../state/workspace-store";
import type { PromptImage } from "../../shared/prompt-images";
import type { PromptFile } from "../../shared/prompt-files";

const EMPTY_IMAGES: PromptImage[] = [];
const EMPTY_FILES: PromptFile[] = [];

const acknowledged = (snapshot: SessionSnapshot, request: PendingRequest) =>
  snapshot.requestId === request.requestId ||
  snapshot.acceptedRequestIds?.includes(request.requestId) ||
  snapshot.state.queue?.some((item) => item.id === request.requestId);

const releaseDraft = (id: string, request: PendingRequest) => {
  if (useRequests.getState().pending[id]?.requestId !== request.requestId) return;
  const workspace = useWorkspace.getState();
  if (workspace.drafts[id] === request.text) workspace.draft(id, "");
  if (JSON.stringify(workspace.images[id] ?? []) === JSON.stringify(request.images ?? []))
    workspace.attach(id, []);
  if (JSON.stringify(workspace.files[id] ?? []) === JSON.stringify(request.files ?? []))
    workspace.attachFiles(id, []);
  if (
    JSON.stringify((workspace.skills[id] ?? []).map((skill) => skill.id)) ===
    JSON.stringify(request.skills ?? [])
  )
    workspace.removeSkill(id);
  useRequests.getState().put(id);
};

export const usePrompt = (snapshot: SessionSnapshot, hasProject = true) => {
  const id = snapshot.sessionId;
  const text = useWorkspace((state) => state.drafts[id] ?? "");
  const images = useWorkspace((state) => state.images[id] ?? EMPTY_IMAGES);
  const files = useWorkspace((state) => state.files[id] ?? EMPTY_FILES);
  const skills = useWorkspace((state) => state.skills[id]);
  const request = useRequests((state) => state.pending[id]);
  const delivery = useRequests((state) => state.delivery[id]);
  const [error, setError] = useState<unknown>();
  const pending = !!request && delivery === "sending";
  const uncertain = !!request && !pending && !acknowledged(snapshot, request);

  useEffect(() => {
    if (request && acknowledged(snapshot, request)) releaseDraft(id, request);
  }, [snapshot, id, request]);

  const submit = async (retry = false) => {
    const existing = useRequests.getState().pending[id];
    if (
      !hasProject ||
      (snapshot.operation !== "idle" && snapshot.operation !== "prompt") ||
      snapshot.state.hasPendingSave
    )
      return;
    if (existing && useRequests.getState().delivery[id] === "sending") return;
    if (retry ? !existing : existing || (!text.trim() && !images.length && !files.length)) return;
    setError(undefined);
    const next = existing ?? {
      requestId: crypto.randomUUID(),
      text,
      streamId: snapshot.streamId,
      ...(images.length ? { images } : {}),
      ...(files.length ? { files } : {}),
      ...(skills?.length ? { skills: skills.map((skill) => skill.id) } : {}),
    };
    useRequests.getState().put(id, next, "sending");
    try {
      if (retry) {
        const current = await api<SessionSnapshot>("/sessions/" + id);
        if (acknowledged(current, next)) {
          releaseDraft(id, next);
          return;
        }
        if (current.streamId !== next.streamId)
          throw new ApiError(
            "delivery_unknown",
            "Server restarted; inspect history before sending again.",
            409,
          );
      }
      await command("/sessions/" + id + "/prompt", {
        requestId: next.requestId,
        streamId: next.streamId,
        text: next.text,
        images: next.images,
        files: next.files,
        skills: next.skills,
      });
      releaseDraft(id, next);
    } catch (error) {
      if (useRequests.getState().pending[id]?.requestId !== next.requestId) return;
      setError(error);
      if (error instanceof ApiError && error.status < 500) useRequests.getState().put(id);
      else useRequests.getState().markDelivery(id, next.requestId);
    }
  };

  return {
    submitted: false,
    text,
    images,
    files,
    setText: (value: string) => useWorkspace.getState().draft(id, value),
    submit,
    pending,
    error,
    uncertain,
  };
};
