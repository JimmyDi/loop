import type { SessionEvent, SessionSnapshot } from "../shared/protocol";
import { applyEvent } from "../shared/session-projection";
import { projectTools } from "../shared/tool-projection";
import { HttpError, errorText } from "./http/errors";
import type { SessionPort } from "./loop";
import { SessionEvents } from "./session-events";

export class SessionController {
  readonly events: SessionEvents;
  snapshot: SessionSnapshot;
  private unsubscribe: () => void;
  private active: Promise<void> = Promise.resolve();
  private requests = new Map<string, { text: string; runId: string }>();
  private settled = false;

  constructor(
    readonly session: SessionPort,
    readonly workspaceId: string,
  ) {
    this.snapshot = {
      streamId: "",
      sessionId: session.sessionId,
      workspaceId,
      state: session.state,
      model: this.model(),
      operation: "idle",
      tools: projectTools(session.state.messages),
    };
    this.events = new SessionEvents(session.sessionId, () => this.snapshot);
    this.snapshot.streamId = this.events.streamId;
    this.unsubscribe = session.subscribe((event) => this.onEvent(event));
  }

  get busy(): boolean {
    return this.snapshot.operation !== "idle" || this.session.state.hasPendingSave;
  }

  prompt(requestId: string, text: string): string {
    const existing = this.requests.get(requestId);

    if (existing) {
      if (existing.text !== text) throw new HttpError(409, "request_conflict");

      return existing.runId;
    }

    this.assertIdle();

    const runId = crypto.randomUUID();

    this.requests.set(requestId, { text, runId });

    if (this.requests.size > 256) this.requests.delete(this.requests.keys().next().value!);

    this.settled = false;
    this.snapshot = {
      ...this.snapshot,
      operation: "prompt",
      requestId,
      runId,
      commandError: undefined,
      state: { ...this.snapshot.state, isRunning: true, outcome: "idle", error: undefined },
    };
    this.events.publish({ type: "run.accepted", requestId, runId });
    this.active = Promise.resolve()
      .then(() => this.session.prompt(text))
      .catch((error) => {
        if (this.snapshot.runId === runId && !this.settled)
          this.snapshot.commandError = errorText(error);
      })
      .finally(() => {
        if (this.snapshot.runId === runId && !this.settled) this.sync();
      });

    return runId;
  }

  async abort(): Promise<void> {
    // Wait one microtask so an accepted prompt has entered the SDK before abort.
    await Promise.resolve();
    await this.session.abort();
    await this.active;
  }

  async command(operation: "model" | "flush", action: () => Promise<void>): Promise<void> {
    this.assertIdle(operation === "flush");
    this.snapshot = { ...this.snapshot, operation, commandError: undefined };
    this.events.publish({ type: "session.state", snapshot: this.snapshot });
    const work = Promise.resolve()
      .then(action)
      .catch((error) => {
        this.snapshot.commandError = errorText(error);
        throw error;
      })
      .finally(() => this.sync());

    this.active = work.catch(() => {});
    await work;
  }

  async close(): Promise<void> {
    await this.abort();

    if (this.session.state.hasPendingSave) await this.command("flush", () => this.session.flush());

    this.dispose();
  }

  dispose(): void {
    this.assertIdle();
    this.session.dispose();
    this.unsubscribe();
    this.events.close();
  }

  private assertIdle(allowPending = false): void {
    if (this.snapshot.operation !== "idle") throw new HttpError(409, "session_busy");

    if (!allowPending && this.session.state.hasPendingSave)
      throw new HttpError(409, "pending_save");
  }

  private model() {
    const { provider, id, name } = this.session.model;

    return { provider, id, name };
  }

  private sync(): void {
    this.snapshot = {
      ...this.snapshot,
      state: this.session.state,
      model: this.model(),
      operation: "idle",
      draftIndex: undefined,
      tools: projectTools(this.session.state.messages),
    };
    this.events.publish({ type: "session.state", snapshot: this.snapshot });
  }

  private onEvent(event: SessionEvent): void {
    const messageIndex =
      "message" in event
        ? (this.snapshot.draftIndex ?? this.snapshot.state.messages.length)
        : undefined;

    this.snapshot = applyEvent(this.snapshot, event, messageIndex);
    this.events.publish({ type: "loop.event", runId: this.snapshot.runId!, event, messageIndex });

    if (event.type === "agent_settled") {
      this.settled = true;
      this.sync();
    }
  }
}
