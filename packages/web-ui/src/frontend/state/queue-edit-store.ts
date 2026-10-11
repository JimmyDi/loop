import { create } from "zustand";

import type { PromptImage } from "../../shared/prompt-images";
import type { PromptFile } from "../../shared/prompt-files";
import { useWorkspace } from "./workspace-store";

export type ComposerDraft = {
  text: string;
  images: PromptImage[];
  files: PromptFile[];
  skills: Array<{ id: string; name: string }>;
};

export const readDraft = (sessionId: string): ComposerDraft => {
  const state = useWorkspace.getState();
  return structuredClone({
    text: state.drafts[sessionId] ?? "",
    images: state.images[sessionId] ?? [],
    files: state.files[sessionId] ?? [],
    skills: state.skills[sessionId] ?? [],
  });
};

export const writeDraft = (sessionId: string, draft: ComposerDraft): void => {
  useWorkspace.setState((state) => ({
    drafts: { ...state.drafts, [sessionId]: draft.text },
    images: { ...state.images, [sessionId]: draft.images },
    files: { ...state.files, [sessionId]: draft.files },
    skills: { ...state.skills, [sessionId]: draft.skills },
  }));
};

export const useQueueEdits = create<{
  edits: Record<string, { id: string; backup: ComposerDraft } | undefined>;
  begin(sessionId: string, id: string, draft: ComposerDraft): void;
  finish(sessionId: string): void;
}>((set, get) => ({
  edits: {},
  begin: (sessionId, id, draft) => {
    if (get().edits[sessionId]) return;
    const backup = readDraft(sessionId);
    set((state) => ({ edits: { ...state.edits, [sessionId]: { id, backup } } }));
    writeDraft(sessionId, draft);
  },
  finish: (sessionId) => {
    const edit = get().edits[sessionId];
    if (!edit) return;
    writeDraft(sessionId, edit.backup);
    set((state) => ({ edits: { ...state.edits, [sessionId]: undefined } }));
  },
}));
