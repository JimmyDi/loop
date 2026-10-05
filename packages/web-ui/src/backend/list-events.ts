import type { Cursor, ListChange, ListFrame } from "../shared/protocol";
import type { SessionController } from "./session-controller";

/** List notifications carry identities only, never conversation snapshots or deltas. */
export class ListEvents {
  readonly streamId = crypto.randomUUID();
  private seq = 0;
  private closed = false;
  private listeners = new Map<(frame: ListFrame) => void, () => void>();
  private subscriptions = new Set<() => void>();

  publish(change: Exclude<ListChange, { type: "lists.reset" }>): void {
    if (this.closed) return;
    const frame = { ...change, streamId: this.streamId, seq: ++this.seq };
    for (const listener of this.listeners.keys()) listener(frame);
  }

  watch(controller: Pick<SessionController, "events" | "workspaceId">): void {
    if (this.closed) return;

    const unsubscribe = controller.events.connect(
      (frame) => {
        if (
          frame.type === "run.accepted" ||
          frame.type === "session.state" ||
          (frame.type === "loop.event" &&
            frame.event.type === "message_end" &&
            frame.event.message.role === "user")
        ) {
          this.publish({ type: "sessions.changed", workspaceId: controller.workspaceId });
        }
      },
      undefined,
      () => this.subscriptions.delete(unsubscribe),
    );
    this.subscriptions.add(unsubscribe);
  }

  connect(listener: (frame: ListFrame) => void, _cursor?: Cursor, onClose = () => {}): () => void {
    if (this.closed) {
      onClose();
      return () => {};
    }
    // Always refresh on connection/reconnection; no replay buffer or disk reads are needed.
    listener({ type: "lists.reset", streamId: this.streamId, seq: this.seq });
    this.listeners.set(listener, onClose);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.closed = true;
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions.clear();
    for (const close of this.listeners.values()) close();
    this.listeners.clear();
  }
}
