import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";

export type Tab = { id: string; workspaceId: string; title: string };

type WorkspaceState = {
  tabs: Tab[];
  active?: string;
  drafts: Record<string, string>;
  sidebar: boolean;
  open(tab: Tab): void;
  close(id: string): void;
  draft(id: string, text: string): void;
  removeProject(id: string): void;
  draftProjects: Record<string, string>;
  expanded: Record<string, boolean>;
  expand(id: string, expanded: boolean): void;
  toggleSidebar(open: boolean): void;
};

const savedTabs = readPreference<unknown>("tabs", []);
const tabs = Array.isArray(savedTabs)
  ? savedTabs.filter(
      (tab): tab is Tab =>
        tab &&
        typeof tab.id === "string" &&
        typeof tab.workspaceId === "string" &&
        typeof tab.title === "string",
    )
  : [];
const savedDrafts = readPreference<Record<string, unknown>>("drafts", {});
const drafts = Object.fromEntries(
  Object.entries(savedDrafts ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export const useWorkspace = create<WorkspaceState>((set) => ({
  tabs,
  active: tabs[0]?.id,
  drafts,
  draftProjects: readPreference<Record<string, string>>("draftProjects", {}),
  expanded: readPreference<Record<string, boolean>>("expanded", {}),
  expand: (id, expanded) => set((state) => ({ expanded: { ...state.expanded, [id]: expanded } })),
  sidebar: false,
  open: (tab) =>
    set((state) => ({
      active: tab.id,
      sidebar: false,
      tabs: state.tabs.some((item) => item.id === tab.id) ? state.tabs : [...state.tabs, tab],
    })),
  close: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.id !== id);

      return { tabs, active: state.active === id ? tabs.at(-1)?.id : state.active };
    }),
  draft: (id, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [id]: text },
      draftProjects: {
        ...state.draftProjects,
        [id]: state.tabs.find((tab) => tab.id === id)?.workspaceId ?? state.draftProjects[id] ?? "",
      },
    })),
  removeProject: (id) =>
    set((state) => {
      const removed = [
        ...state.tabs.filter((tab) => tab.workspaceId === id).map((tab) => tab.id),
        ...Object.keys(state.draftProjects).filter((key) => state.draftProjects[key] === id),
      ];
      const tabs = state.tabs.filter((tab) => tab.workspaceId !== id);

      return {
        tabs,
        active: removed.includes(state.active ?? "") ? tabs[0]?.id : state.active,
        drafts: Object.fromEntries(
          Object.entries(state.drafts).filter(([id]) => !removed.includes(id)),
        ),
        draftProjects: Object.fromEntries(
          Object.entries(state.draftProjects).filter(([id]) => !removed.includes(id)),
        ),
      };
    }),
  toggleSidebar: (sidebar) => set({ sidebar }),
}));

useWorkspace.subscribe((state, previous) => {
  if (state.tabs !== previous.tabs) writePreference("tabs", state.tabs);

  if (state.drafts !== previous.drafts) writePreference("drafts", state.drafts);

  if (state.draftProjects !== previous.draftProjects)
    writePreference("draftProjects", state.draftProjects);

  if (state.expanded !== previous.expanded) writePreference("expanded", state.expanded);
});
