import type { ModelThinkingLevel } from "@earendil-works/pi-ai";

export type ModelEffort = "default" | ModelThinkingLevel;

export const isModelEffort = (value: unknown): value is ModelEffort =>
  typeof value === "string" &&
  ["default", "off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(value);
