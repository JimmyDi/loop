import type { Message } from "@earendil-works/pi-ai";

export function validateMessages(input: unknown): asserts input is Message[] {
  if (!Array.isArray(input)) throw new Error("Invalid session messages");

  const pending = new Map<string, string>();

  for (const message of input) {
    if (!message || !Number.isFinite(message.timestamp))
      throw new Error("Invalid message timestamp");

    if (!["user", "assistant", "toolResult"].includes(message.role))
      throw new Error("Unsupported message role");

    if (message.role === "user" && typeof message.content === "string") {
      if (pending.size) throw new Error("Unfinished tool calls; automatic replay is not supported");

      continue;
    }

    if (!Array.isArray(message.content)) throw new Error("Invalid message content");

    for (const part of message.content) {
      if (!part || typeof part !== "object") throw new Error("Invalid content block");

      const valid =
        (part.type === "text" && typeof part.text === "string") ||
        (part.type === "image" &&
          message.role !== "assistant" &&
          typeof part.data === "string" &&
          typeof part.mimeType === "string") ||
        (part.type === "thinking" &&
          message.role === "assistant" &&
          typeof part.thinking === "string") ||
        (part.type === "toolCall" &&
          message.role === "assistant" &&
          typeof part.id === "string" &&
          typeof part.name === "string" &&
          part.arguments &&
          typeof part.arguments === "object" &&
          !Array.isArray(part.arguments));

      if (!valid) throw new Error("Unsupported or invalid content block");
    }

    if (message.role === "assistant") {
      if (pending.size) throw new Error("Unfinished tool calls; automatic replay is not supported");

      if (
        !["stop", "toolUse", "length", "error", "aborted", "deferred", "pending"].includes(
          message.stopReason,
        ) ||
        ![message.model, message.provider, message.api].every(
          (value) => typeof value === "string",
        ) ||
        !message.usage ||
        typeof message.usage !== "object"
      )
        throw new Error("Invalid assistant message");

      if (message.stopReason === "error" || message.stopReason === "aborted") continue;

      for (const part of message.content) {
        if (part.type !== "toolCall") continue;

        if (pending.has(part.id)) throw new Error("Duplicate tool call ID");

        pending.set(part.id, part.name);
      }
    } else if (message.role === "toolResult") {
      if (
        typeof message.isError !== "boolean" ||
        typeof message.toolCallId !== "string" ||
        typeof message.toolName !== "string" ||
        !pending.has(message.toolCallId) ||
        pending.get(message.toolCallId) !== message.toolName
      )
        throw new Error("Unmatched tool result");

      pending.delete(message.toolCallId);
    } else if (pending.size)
      throw new Error("Unfinished tool calls; automatic replay is not supported");
  }

  if (pending.size) throw new Error("Unfinished tool calls; automatic replay is not supported");
}

export function messageText(message?: Message): string {
  if (!message) return "";

  return typeof message.content === "string"
    ? message.content
    : message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
}
