import { create } from "zustand";

import type { Cursor, Frame, SessionSnapshot, SessionHistoryPage } from "../../shared/protocol";
import { projectTools } from "../../shared/tool-projection";
import { pageSnapshot } from "../../shared/session-history";
import { applyFrame } from "../../shared/session-projection";

export type SessionView = {
  snapshot?: SessionSnapshot;
  cursor?: Cursor;
  connected: boolean;
  revision?: number;
};

type SessionsState = {
  views: Record<string, SessionView>;
  frame(frame: Frame): boolean;
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
  frame: (frame) => {
    const previous = get().views[frame.sessionId];
    const cursor = previous?.cursor;

    if (
      frame.type === "session.snapshot" &&
      cursor?.streamId === frame.streamId &&
      frame.seq < cursor.seq
    )
      return true;

    if (frame.type !== "session.snapshot" && cursor) {
      if (cursor.streamId !== frame.streamId || frame.seq > cursor.seq + 1) return false;

      if (frame.seq <= cursor.seq) return true;
    }

    const snapshot = applyFrame(previous?.snapshot, frame);

    if (!snapshot) return false;

    set((state) => ({
      views: {
        ...state.views,
        [frame.sessionId]: {
          snapshot,
          revision: previous?.revision,
          connected: true,
          cursor: { streamId: frame.streamId, seq: frame.seq },
        },
      },
    }));

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
