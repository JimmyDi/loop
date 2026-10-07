import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";
import { validImages } from "../../shared/prompt-images";
import type { PromptImage } from "../../shared/prompt-images";
import { validTextFiles } from "../../shared/prompt-files";
import type { PromptFile } from "../../shared/prompt-files";

export type PendingRequest = {
  requestId: string;
  text: string;
  streamId: string;
  images?: PromptImage[];
  files?: PromptFile[];
  skills?: string[];
};

type Delivery = "sending" | "accepted";

type Requests = {
  pending: Record<string, PendingRequest>;
  delivery: Record<string, Delivery>;
  put(id: string, request?: PendingRequest, delivery?: Delivery): void;
  markDelivery(id: string, requestId: string, delivery?: Delivery): void;
};

const saved = readPreference<Record<string, PendingRequest>>("requests", {});
const pending = Object.fromEntries(
  Object.entries(saved ?? {}).filter(
    ([, value]) =>
      value &&
      typeof value.requestId === "string" &&
      typeof value.text === "string" &&
      typeof value.streamId === "string" &&
      (value.images === undefined || validImages(value.images)) &&
      (value.files === undefined || validTextFiles(value.files)) &&
      (value.skills === undefined ||
        (Array.isArray(value.skills) &&
          value.skills.length <= 8 &&
          value.skills.every((id) => typeof id === "string" && /^[a-f0-9]{24}$/.test(id)))),
  ),
);

export const useRequests = create<Requests>((set) => ({
  pending,
  // Delivery acknowledgments apply only to this page lifetime, never to a reload.
  delivery: {},
  put: (id, request, status) =>
    set((state) => {
      const pending = { ...state.pending };
      const delivery = { ...state.delivery };

      if (request) pending[id] = request;
      else delete pending[id];

      if (request && status) delivery[id] = status;
      else delete delivery[id];

      return { pending, delivery };
    }),
  markDelivery: (id, requestId, status) =>
    set((state) => {
      if (state.pending[id]?.requestId !== requestId) return state;

      const delivery = { ...state.delivery };

      if (status) delivery[id] = status;
      else delete delivery[id];

      return { delivery };
    }),
}));

useRequests.subscribe((state) => writePreference("requests", state.pending));
