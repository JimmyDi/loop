import { useQueryClient } from "@tanstack/react-query";

import type { QueuedMessage } from "@loop/coding-agent";
import type { SessionSnapshot } from "../../shared/protocol";
import { queuedContent } from "../../shared/queued-content";
import { command } from "../lib/api";
import { readDraft, useQueueEdits } from "../state/queue-edit-store";
import { skillQueryOptions } from "./useSkills";
import { useAsyncAction } from "./useAsyncAction";

export const useQueuedComposer = (snapshot: SessionSnapshot, focus: () => void) => {
  const sessionId = snapshot.sessionId;
  const editing = useQueueEdits((state) => state.edits[sessionId]);
  const action = useAsyncAction();
  const client = useQueryClient();
  const begin = (id: string) =>
    action.run(async () => {
      if (useQueueEdits.getState().edits[sessionId]) return;
      const { item } = await command<{ item: QueuedMessage }>("/sessions/" + sessionId + "/queue", {
        id,
        action: "begin-edit",
      });
      const catalog = item.skills.length
        ? await client.fetchQuery(skillQueryOptions(snapshot.workspaceId)).catch(() => undefined)
        : undefined;
      useQueueEdits.getState().begin(sessionId, id, {
        ...queuedContent(item.content),
        skills: item.skills.map((id) => ({
          id,
          name: catalog?.skills.find((skill) => skill.id === id)?.name ?? id,
        })),
      });
      focus();
    });
  const save = () =>
    action.run(async () => {
      const edit = useQueueEdits.getState().edits[sessionId];
      if (!edit) return;
      const draft = readDraft(sessionId);
      await command("/sessions/" + sessionId + "/queue", {
        id: edit.id,
        action: "edit",
        text: draft.text,
        images: draft.images,
        files: draft.files,
        skills: draft.skills.map((skill) => skill.id),
      });
      useQueueEdits.getState().finish(sessionId);
      focus();
    });
  return { editing, begin, save, pending: action.pending, error: action.error };
};
