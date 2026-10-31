import type { Frame } from "../../shared/protocol";
import { applyFrame } from "../../shared/session-projection";
import type { SessionView } from "./session-store";

export const projectSessionFrame = (
  previous: SessionView | undefined,
  frame: Frame,
): SessionView | undefined => {
  const cursor = previous?.cursor;
  if (
    frame.type === "session.snapshot" &&
    cursor?.streamId === frame.streamId &&
    frame.seq < cursor.seq
  )
    return previous;
  if (frame.type !== "session.snapshot" && cursor) {
    if (cursor.streamId !== frame.streamId || frame.seq > cursor.seq + 1) return undefined;
    if (frame.seq <= cursor.seq) return previous;
  }
  const snapshot = applyFrame(previous?.snapshot, frame);
  if (!snapshot) return undefined;
  return {
    snapshot,
    revision: previous?.revision,
    connected: true,
    cursor: { streamId: frame.streamId, seq: frame.seq },
  };
};
