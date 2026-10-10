import type { Message } from "@earendil-works/pi-ai";

/** Host-owned labels are presentation metadata, never model tool identifiers. */
export type ToolDisplayNames = ReadonlyMap<string, string>;

export const withToolDisplayName = <T extends Message>(message: T, names: ToolDisplayNames): T => {
  if (message.role !== "toolResult") return message;
  const displayName = names.get(message.toolName);
  if (!displayName) return message;
  const details =
    message.details && typeof message.details === "object" && !Array.isArray(message.details)
      ? message.details
      : undefined;
  if (details && "loopDisplayName" in details && typeof details.loopDisplayName === "string")
    return message;
  return { ...message, details: { ...details, loopDisplayName: displayName } };
};
