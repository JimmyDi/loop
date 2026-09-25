import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";

export type PendingRequest = { requestId: string; text: string; streamId: string };

type Requests = {
  pending: Record<string, PendingRequest>;
  put(id: string, request?: PendingRequest): void;
};

const saved = readPreference<Record<string, PendingRequest>>("requests", {});
const pending = Object.fromEntries(
  Object.entries(saved ?? {}).filter(
    ([, value]) =>
      value &&
      typeof value.requestId === "string" &&
      typeof value.text === "string" &&
      typeof value.streamId === "string",
  ),
);

export const useRequests = create<Requests>((set) => ({
  pending,
  put: (id, request) =>
    set((state) => {
      const pending = { ...state.pending };

      if (request) pending[id] = request;
      else delete pending[id];

      return { pending };
    }),
}));

useRequests.subscribe((state) => writePreference("requests", state.pending));
