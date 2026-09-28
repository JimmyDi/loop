import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";
import type { PromptImage } from "../../shared/prompt-images";
import type { PromptFile } from "../../shared/prompt-files";

type SessionSelection = { id: string; workspaceId: string };

type WorkspaceState = {
  active?: SessionSelection;
  drafts: Record<string, string>;
  images: Record<string, PromptImage[]>;
  files: Record<string, PromptFile[]>;
  attachFiles(id: string, files: PromptFile[]): void;
  attach(id: string, images: PromptImage[]): void;
  sidebar: boolean;
  open(session: SessionSelection): void;
  draft(id: string, text: string): void;
  removeProject(id: string): void;
  removeSessions(ids: string[]): void;
  draftProjects: Record<string, string>;
  expanded: Record<string, boolean>;
  expand(id: string, expanded: boolean): void;
  toggleSidebar(open: boolean): void;
};

const savedActive = readPreference<unknown>("activeSession", undefined);
const active: SessionSelection | undefined =
  savedActive &&
  typeof savedActive === "object" &&
  "id" in savedActive &&
  typeof savedActive.id === "string" &&
  savedActive.id &&
  "workspaceId" in savedActive &&
  typeof savedActive.workspaceId === "string" &&
  savedActive.workspaceId
    ? { id: savedActive.id, workspaceId: savedActive.workspaceId }
    : undefined;
const savedDrafts = readPreference<Record<string, unknown>>("drafts", {});
const drafts = Object.fromEntries(
  Object.entries(savedDrafts ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export const useWorkspace = create<WorkspaceState>((set) => ({
  active,
  drafts,
  images: {},
  files: {},
  attachFiles: (id, files) => set((state) => ({ files: { ...state.files, [id]: files } })),
  attach: (id, images) =>
    set((state) => ({
      images: { ...state.images, [id]: images },
    })),
  draftProjects: readPreference<Record<string, string>>("draftProjects", {}),
  expanded: readPreference<Record<string, boolean>>("expanded", {}),
  expand: (id, expanded) => set((state) => ({ expanded: { ...state.expanded, [id]: expanded } })),
  sidebar: false,
  open: (session) =>
    set((state) => ({
      active: { id: session.id, workspaceId: session.workspaceId },
      sidebar: false,
      draftProjects: { ...state.draftProjects, [session.id]: session.workspaceId },
    })),
  draft: (id, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [id]: text },
    })),
  removeProject: (id) =>
    set((state) => {
      const removed = Object.keys(state.draftProjects).filter(
        (key) => state.draftProjects[key] === id,
      );
      if (state.active?.workspaceId === id) removed.push(state.active.id);

      return {
        active: state.active?.workspaceId === id ? undefined : state.active,
        drafts: Object.fromEntries(
          Object.entries(state.drafts).filter(([id]) => !removed.includes(id)),
        ),
        images: Object.fromEntries(
          Object.entries(state.images).filter(([key]) => !removed.includes(key)),
        ),
        files: Object.fromEntries(
          Object.entries(state.files).filter(([key]) => !removed.includes(key)),
        ),
        draftProjects: Object.fromEntries(
          Object.entries(state.draftProjects).filter(([id]) => !removed.includes(id)),
        ),
      };
    }),
  removeSessions: (ids) =>
    set((state) => ({
      active: state.active && ids.includes(state.active.id) ? undefined : state.active,
      drafts: Object.fromEntries(Object.entries(state.drafts).filter(([id]) => !ids.includes(id))),
      images: Object.fromEntries(Object.entries(state.images).filter(([id]) => !ids.includes(id))),
      files: Object.fromEntries(Object.entries(state.files).filter(([id]) => !ids.includes(id))),
      draftProjects: Object.fromEntries(
        Object.entries(state.draftProjects).filter(([id]) => !ids.includes(id)),
      ),
    })),
  toggleSidebar: (sidebar) => set({ sidebar }),
}));

useWorkspace.subscribe((state, previous) => {
  if (state.active !== previous.active) writePreference("activeSession", state.active ?? null);

  if (state.drafts !== previous.drafts) writePreference("drafts", state.drafts);

  if (state.draftProjects !== previous.draftProjects)
    writePreference("draftProjects", state.draftProjects);

  if (state.expanded !== previous.expanded) writePreference("expanded", state.expanded);
});
