import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";

const saved = readPreference<unknown>("readTurns", {});
const readTurns = Object.fromEntries(
  Object.entries(saved && typeof saved === "object" ? saved : {}).filter(
    (entry): entry is [string, number] => Number.isSafeInteger(entry[1]) && entry[1] >= 0,
  ),
);

type ReadState = {
  readTurns: Record<string, number>;
  markRead(id: string, turn: number): void;
};

export const useReadState = create<ReadState>((set) => ({
  readTurns,
  markRead: (id, turn) =>
    set((state) => {
      if (!Number.isSafeInteger(turn) || turn < 0 || (state.readTurns[id] ?? -1) >= turn)
        return state;
      return { readTurns: { ...state.readTurns, [id]: turn } };
    }),
}));

useReadState.subscribe((state, previous) => {
  if (state.readTurns !== previous.readTurns) writePreference("readTurns", state.readTurns);
});
