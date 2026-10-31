import { create } from "zustand";

import type { Cursor, Frame, SessionSnapshot, SessionHistoryPage } from "../../shared/protocol";
import { projectTools } from "../../shared/tool-projection";
import { pageSnapshot } from "../../shared/session-history";
import { projectSessionFrame } from "./session-frame";

export type SessionView = {
  snapshot?: SessionSnapshot;
  cursor?: Cursor;
  connected: boolean;
  revision?: number;
};

type SessionsState = {
  views: Record<string, SessionView>;
  frame(frame: Frame): boolean;
  frames(frames: readonly Frame[]): boolean;
  connection(id: string, connected: boolean): void;
  resync(id: string): void;
  prepend(id: string, page: SessionHistoryPage): boolean;
  latest(id: string): void;
};

export const useSessions = create<SessionsState>((set, get) => ({
  views: {},
  latest: (id) =>
    set((state) => {
      const view = state.views[id];
      return view?.snapshot?.history
        ? { views: { ...state.views, [id]: { ...view, snapshot: pageSnapshot(view.snapshot) } } }
        : {};
    }),
  prepend: (id, page) => {
    const view = get().views[id];
    const snapshot = view?.snapshot;
    if (
      !snapshot?.history ||
      snapshot.streamId !== page.streamId ||
      snapshot.history.start !== page.end
    )
      return false;
    const messages = [...page.messages, ...snapshot.state.messages];
    set((state) => ({
      views: {
        ...state.views,
        [id]: {
          ...view,
          snapshot: {
            ...snapshot,
            history: { ...snapshot.history!, start: page.start, userStart: page.userStart },
            state: { ...snapshot.state, messages },
            tools: { ...projectTools(page.messages), ...snapshot.tools },
          },
        },
      },
    }));
    return true;
  },
  frame: (frame) => get().frames([frame]),
  frames: (frames) => {
    const views = { ...get().views };
    for (const frame of frames) {
      const view = projectSessionFrame(views[frame.sessionId], frame);
      if (!view) return false;
      views[frame.sessionId] = view;
    }
    if (frames.length) set({ views });
    return true;
  },
  connection: (id, connected) =>
    set((state) => ({
      views: {
        ...state.views,
        [id]: { ...state.views[id], connected },
      },
    })),
  resync: (id) =>
    set((state) => ({
      views: {
        ...state.views,
        [id]: {
          ...state.views[id],
          cursor: undefined,
          connected: false,
          revision: (state.views[id]?.revision ?? 0) + 1,
        },
      },
    })),
}));
