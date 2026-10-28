import type { SessionSnapshot } from "../../shared/protocol";
import { messageText } from "../../shared/message-text";
import type { VoiceNarrationRow } from "./narration-types";

import { speechSegments } from "./speech-segments";

export const voiceNarration = (
  snapshot: SessionSnapshot,
  minimumPosition = 0,
): VoiceNarrationRow[] => {
  const rows: VoiceNarrationRow[] = [];
  const positions = new Map<string, number>();
  const start = snapshot.history?.start ?? 0;
  const messages = [...snapshot.state.messages];
  if (snapshot.state.draft) messages.push(snapshot.state.draft);
  for (const [index, message] of messages.entries()) {
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
    let text = messageText(message)
      .replace(/```[\s\S]*?```/g, "")
      .replace(/```[\s\S]*$/, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();
    if (index === snapshot.state.messages.length) {
      let boundary = 0;
      for (const match of text.matchAll(/[。！？.!?\n]/g)) boundary = match.index + 1;
      text = text.slice(0, boundary);
    }
    const sentences = speechSegments(text);
    for (const [sentence, part] of sentences.entries())
      rows.push({
        id: "reply:" + (start + index) + ":" + message.timestamp + ":" + sentence,
        kind: "reply",
        text: part,
      });
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
