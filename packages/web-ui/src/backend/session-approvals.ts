import type { ApprovalDecision, Cursor, Frame } from "../shared/protocol";
import type { SessionPort } from "./loop";
import type { SessionEvents } from "./session-events";
import { HttpError } from "./http/errors";

/** One handler per session, shared by explicitly interactive event connections. */
export class SessionApprovals {
  private clients = 0;
  private detach?: () => void;
  private disposed = false;

  constructor(
    private readonly session: SessionPort,
    private readonly events: SessionEvents,
  ) {}

  connect(listener: (frame: Frame) => void, cursor?: Cursor, onClose = () => {}): () => void {
    if (this.disposed) throw new HttpError(410, "session_closed");
    this.detach ??= this.session.registerApprovalHandler(() => {
      if (!this.clients) throw new Error("No approval interface connected");
      // The session event subscription has already published the pending snapshot.
    });
    this.clients++;
    let disconnected = false;
    let unsubscribe = () => {};
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true;
      unsubscribe();
      this.clients--;
      // Keep existing approvals pending while the user is away; reconnect restores them.
    };
    try {
      unsubscribe = this.events.connect(listener, cursor, () => {
        disconnect();
        onClose();
      });
      if (disconnected) unsubscribe();
    } catch (error) {
      disconnect();
      throw error;
    }
    return disconnect;
  }

  respond(requestId: string, decision: ApprovalDecision): void {
    if (
      this.disposed ||
      !this.clients ||
      !this.session.respondToApproval({
        sessionId: this.session.sessionId,
        requestId,
        decision,
      })
    )
      throw new HttpError(409, "approval_not_pending");
  }

  dispose(): void {
    this.disposed = true;
    this.release();
  }

  private release(): void {
    const detach = this.detach;
    this.detach = undefined;
    detach?.();
  }
}
