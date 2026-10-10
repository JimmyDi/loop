import { ApiError } from "./api";

/** Recognize the HTTP notice and legacy live-session text without hiding other failures. */
export const isNothingToCompact = (error: unknown): boolean =>
  error === "Nothing to compact" ||
  (error instanceof ApiError && error.code === "nothing_to_compact");
