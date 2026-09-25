import { create } from "zustand";

import type { Cursor, Frame, SessionSnapshot } from "../../shared/protocol";
import { applyFrame } from "../../shared/session-projection";

export type SessionView = { snapshot?: SessionSnapshot; cursor?: Cursor; connected: boolean };

type SessionsState = {
  views: Record<string, SessionView>;
  frame(frame: Frame): boolean;
  connection(id: string, connected: boolean): void;
};

export const useSessions = create<SessionsState>((set, get) => ({
  views: {},
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
}));
