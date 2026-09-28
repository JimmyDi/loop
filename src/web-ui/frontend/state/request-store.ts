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
};

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
      typeof value.streamId === "string" &&
      (value.images === undefined || validImages(value.images)) &&
      (value.files === undefined || validTextFiles(value.files)),
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
