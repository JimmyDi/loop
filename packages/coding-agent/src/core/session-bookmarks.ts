import type { Message } from "@earendil-works/pi-ai";

export const validateBookmarks = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (
    !Array.isArray(value) ||
    value.some(
      (index) => !Number.isSafeInteger(index) || index < 0 || messages[index]?.role !== "user",
    ) ||
    new Set(value).size !== value.length
  )
    throw new Error("Invalid session bookmarks");
};
