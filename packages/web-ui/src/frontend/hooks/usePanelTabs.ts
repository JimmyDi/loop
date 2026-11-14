import { useState } from "react";

export type PanelTab<T> = { id: string; title: string; content: T };

export const usePanelTabs = <T>(scope: string) => {
  const [state, setState] = useState<{
    scope: string;
    open: boolean;
    active?: string;
    tabs: PanelTab<T>[];
  }>({ scope, open: false, tabs: [] });
  const current = state.scope === scope ? state : { scope, open: false, tabs: [] as PanelTab<T>[] };
  const update = (change: (state: typeof current) => typeof current) =>
    setState((previous) =>
      change(previous.scope === scope ? previous : { scope, open: false, tabs: [] }),
    );
  return {
    ...current,
    toggle: () => update((state) => ({ ...state, open: !state.open })),
    hide: () => update((state) => ({ ...state, open: false })),
    add: (tab: PanelTab<T>) =>
      update((state) => ({
        ...state,
        open: true,
        active: tab.id,
        tabs: state.tabs.some((item) => item.id === tab.id) ? state.tabs : [...state.tabs, tab],
      })),
    select: (id: string) =>
      update((state) =>
        state.tabs.some((tab) => tab.id === id) ? { ...state, active: id } : state,
      ),
    close: (id: string) =>
      update((state) => {
        const index = state.tabs.findIndex((tab) => tab.id === id);
        const tabs = state.tabs.filter((tab) => tab.id !== id);
        return {
          ...state,
          tabs,
          active: state.active === id ? tabs[Math.max(0, index - 1)]?.id : state.active,
        };
      }),
  };
};
