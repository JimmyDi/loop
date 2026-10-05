import { createHash } from "node:crypto";
import type { SessionEvent, SessionSnapshot } from "../shared/protocol";
import { getModelEfforts } from "@loop/coding-agent";
import { applyEvent } from "../shared/session-projection";
import { projectTools } from "../shared/tool-projection";
import { HttpError, errorText } from "./http/errors";
import type { SessionPort } from "./loop";
import { SessionEvents } from "./session-events";
import { SessionApprovals } from "./session-approvals";
import { promptContent } from "../shared/prompt-images";
import type { PromptImage } from "../shared/prompt-images";
import type { PromptFile } from "../shared/prompt-files";

export class SessionController {
  readonly createdAt = new Date().toISOString();
  readonly events: SessionEvents;
  readonly approvals: SessionApprovals;
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
      effort: session.effort,
      operation: "idle",
      tools: projectTools(session.state.messages),
    };
    this.events = new SessionEvents(session.sessionId, () => this.snapshot);
    this.snapshot.streamId = this.events.streamId;
    this.approvals = new SessionApprovals(session, this.events);
    this.unsubscribe = session.subscribe((event) => this.onEvent(event));
  }

  get busy(): boolean {
    return (
      this.snapshot.operation !== "idle" ||
      this.session.state.hasPendingSave ||
      !!this.session.state.pendingApprovals?.length
    );
  }

  prompt(
    requestId: string,
    text: string,
    images: PromptImage[] = [],
    files: PromptFile[] = [],
  ): string {
    const content = structuredClone(promptContent(text, images, files));
    const signature = createHash("sha256").update(JSON.stringify(content)).digest("hex");
    const existing = this.requests.get(requestId);

    if (existing) {
      if (existing.text !== signature) throw new HttpError(409, "request_conflict");

      return existing.runId;
    }

    this.assertIdle();
    if (images.length && !this.session.model.input.includes("image"))
      throw new HttpError(400, "model_images_unsupported");

    const runId = crypto.randomUUID();

    this.requests.set(requestId, { text: signature, runId });

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
      .then(() => this.session.prompt(content))
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

  async markRead(messageCount: number): Promise<boolean> {
    const read = await this.session.sessionManager.markRead(messageCount);
    if (read) {
      this.snapshot = {
        ...this.snapshot,
        state: { ...this.snapshot.state, unread: this.session.sessionManager.unread },
      };
      this.events.publish({ type: "session.state", snapshot: this.snapshot });
    }
    return read;
  }

  async command(
    operation: "model" | "flush" | "title" | "permission",
    action: () => Promise<void>,
  ): Promise<void> {
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
    this.approvals.dispose();
    this.unsubscribe();
    this.events.close();
  }

  private assertIdle(allowPending = false): void {
    if (this.snapshot.operation !== "idle" || this.session.state.pendingApprovals?.length)
      throw new HttpError(409, "session_busy");

    if (!allowPending && this.session.state.hasPendingSave)
      throw new HttpError(409, "pending_save");
  }

  private model() {
    const { provider, id, name } = this.session.model;

    return {
      provider,
      id,
      name,
      efforts: getModelEfforts(this.session.model),
      input: [...this.session.model.input],
    };
  }

  private sync(): void {
    this.snapshot = {
      ...this.snapshot,
      state: this.session.state,
      model: this.model(),
      effort: this.session.effort,
      operation: "idle",
      draftIndex: undefined,
      draftPhase: undefined,
      tools: projectTools(this.session.state.messages),
    };
    this.events.publish({ type: "session.state", snapshot: this.snapshot });
  }

  private onEvent(event: SessionEvent): void {
    if (
      event.type === "session_title" ||
      event.type === "permission_changed" ||
      event.type === "approval_requested" ||
      event.type === "approval_resolved"
    ) {
      this.snapshot = applyEvent(this.snapshot, event);
      this.events.publish({ type: "session.state", snapshot: this.snapshot });
      return;
    }
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
