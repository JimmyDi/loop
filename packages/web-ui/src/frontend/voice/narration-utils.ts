import type { SessionSnapshot } from "../../shared/protocol";
import { messageText } from "../../shared/message-text";
import type { VoiceNarrationRow } from "./narration-types";

const replySentences = (text: string): string[] => {
  const sentences =
    text
      .match(/[^。！？.!?\n]+[。！？.!?]?/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [];
  return sentences.filter((part) => part.length <= 110).slice(0, 2);
};

export const voiceNarration = (
  snapshot: SessionSnapshot,
  minimumPosition = 0,
): VoiceNarrationRow[] => {
  const rows: VoiceNarrationRow[] = [];
  const positions = new Map<string, number>();
  const start = snapshot.history?.start ?? 0;
  for (const [index, message] of snapshot.state.messages.entries()) {
    if (message.role === "assistant")
      for (const part of message.content)
        if (part.type === "toolCall") positions.set(part.id, start + index);
    if (
      start + index < minimumPosition ||
      message.role !== "assistant" ||
      message.stopReason === "aborted" ||
      message.stopReason === "error"
    )
      continue;
    const text = messageText(message)
      .replace(/```[\s\S]*?```/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();
    const sentences = replySentences(text);
    for (const [sentence, part] of sentences.entries())
      rows.push({
        id: "reply:" + (start + index) + ":" + message.timestamp + ":" + sentence,
        kind: "reply",
        text: part,
      });
    if (text && sentences.join("").replace(/\s/g, "").length < text.replace(/\s/g, "").length)
      rows.push({ id: "reply:" + (start + index) + ":details", kind: "details", text: "" });
  }
  for (const tool of Object.values(snapshot.tools)) {
    if (
      (positions.get(tool.id) ??
        snapshot.history?.total ??
        start + snapshot.state.messages.length) < minimumPosition
    )
      continue;
    const kind =
      tool.status === "running"
        ? "toolStart"
        : tool.status === "error"
          ? "toolError"
          : tool.status === "success"
            ? "toolEnd"
            : undefined;
    if (kind) rows.push({ id: tool.id + ":" + kind, kind, text: tool.displayName ?? tool.name });
  }
  for (const request of snapshot.state.pendingApprovals ?? [])
    rows.push({ id: "approval:" + request.requestId, kind: "approval", text: "" });
  return rows;
};
