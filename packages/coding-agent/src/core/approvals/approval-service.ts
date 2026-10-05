import type { ApprovalPolicy } from "../permissions/types";
import { DEFAULT_APPROVAL_TIMEOUT_MS } from "./types";
import type {
  ApprovalEvent,
  ApprovalHandler,
  ApprovalInput,
  ApprovalOutcome,
  ApprovalRequest,
  ApprovalRequestOptions,
  ApprovalResponse,
  ApprovalResult,
} from "./types";

type HandlerRegistration = { deliver: ApprovalHandler };

type PendingApproval = {
  request: ApprovalRequest;
  interactive: boolean;
  handler?: HandlerRegistration;
  deadline: number | null;
  signal?: AbortSignal;
  cleanup: () => void;
  resolve: (result: ApprovalResult) => void;
};

/** Session-owned interaction state. This service does not grant tool execution authority. */
export class ApprovalService {
  private requests = new Map<string, PendingApproval>();
  private handler?: HandlerRegistration;
  private disposed = false;
  private cancelling = false;
  private events: ApprovalEvent[] = [];
  private publishing = false;

  constructor(
    private readonly sessionId: string,
    private readonly policy: () => ApprovalPolicy,
    private readonly emit: (event: ApprovalEvent) => void,
  ) {}

  get pending(): ApprovalRequest[] {
    return [...this.requests.values()].map(({ request }) => structuredClone(request));
  }

  registerHandler(handler: ApprovalHandler): () => void {
    if (this.disposed) throw new Error("Approval service is disposed");
    if (typeof handler !== "function") throw new Error("Approval handler must be a function");
    if (this.handler) throw new Error("An approval handler is already registered");

    const registration = { deliver: handler };
    this.handler = registration;
    let detached = false;

    return () => {
      if (detached || this.handler !== registration) return;

      detached = true;
      this.handler = undefined;
      for (const pending of [...this.requests.values()]) this.settle(pending, "unavailable");
    };
  }

  async request(
    input: ApprovalInput,
    options: ApprovalRequestOptions = {},
  ): Promise<ApprovalResult> {
    if (
      !input ||
      [input.toolCallId, input.toolName, input.reason].some(
        (value) => typeof value !== "string" || !value.trim(),
      )
    )
      throw new Error("Approval requires a tool call ID, tool name and reason");

    const timeoutMs = options.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS;
    if (
      timeoutMs !== null &&
      (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
    )
      throw new Error("Approval timeout must be a positive 32-bit integer");

    const createdAt = Date.now();
    const request: ApprovalRequest = Object.freeze({
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      reason: input.reason,
      ...(input.operation ? { operation: structuredClone(input.operation) } : {}),
      requestId: crypto.randomUUID(),
      sessionId: this.sessionId,
      policy: this.policy(),
      createdAt,
      expiresAt: timeoutMs === null ? null : createdAt + timeoutMs,
    });
    const handler = this.handler;
    const immediate: ApprovalOutcome | undefined =
      this.cancelling || options.signal?.aborted
        ? "cancelled"
        : this.disposed
          ? "unavailable"
          : request.policy !== "ask"
            ? "rejected"
            : !handler
              ? "unavailable"
              : undefined;
    const { promise, resolve } = Promise.withResolvers<ApprovalResult>();
    const pending: PendingApproval = {
      request,
      interactive: immediate === undefined,
      handler,
      deadline: timeoutMs === null ? null : performance.now() + timeoutMs,
      signal: options.signal,
      cleanup: () => {},
      resolve,
    };
    this.requests.set(request.requestId, pending);

    const cancel = () => this.settle(pending, "cancelled");
    const timer =
      timeoutMs === null
        ? undefined
        : setTimeout(() => this.settle(pending, "timed-out"), timeoutMs);
    options.signal?.addEventListener("abort", cancel, { once: true });
    pending.cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
    };

    this.publish({ type: "approval_requested", request });
    if (immediate) this.settle(pending, immediate);
    else if (this.requests.has(request.requestId)) {
      try {
        const delivery = handler!.deliver(structuredClone(request));
        void Promise.resolve(delivery).then(
          (value) => {
            if (value !== undefined) this.settle(pending, "unavailable");
          },
          () => this.settle(pending, "unavailable"),
        );
      } catch {
        this.settle(pending, "unavailable");
      }
    }

    return promise;
  }

  respond(response: ApprovalResponse): boolean {
    if (
      !response ||
      response.sessionId !== this.sessionId ||
      (response.decision !== "allowed-once" && response.decision !== "rejected")
    )
      return false;

    const pending = this.requests.get(response.requestId);
    if (!pending?.interactive) return false;
    if (this.cancelling || this.disposed || pending.signal?.aborted) {
      this.settle(pending, "cancelled");
      return false;
    }
    if (!this.handler || pending.handler !== this.handler) {
      this.settle(pending, "unavailable");
      return false;
    }
    if (pending.deadline !== null && performance.now() >= pending.deadline) {
      this.settle(pending, "timed-out");
      return false;
    }

    return this.settle(pending, response.decision);
  }

  cancelPending(): void {
    if (this.cancelling) return;

    this.cancelling = true;
    try {
      for (const pending of [...this.requests.values()]) this.settle(pending, "cancelled");
    } finally {
      this.cancelling = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.handler = undefined;
    this.cancelPending();
  }

  private settle(pending: PendingApproval, outcome: ApprovalOutcome): boolean {
    if (!this.requests.delete(pending.request.requestId)) return false;

    pending.cleanup();
    const result: ApprovalResult = { request: pending.request, outcome, resolvedAt: Date.now() };
    pending.resolve(structuredClone(result));
    this.publish({ type: "approval_resolved", result });
    return true;
  }

  private publish(event: ApprovalEvent): void {
    this.events.push(event);
    if (this.publishing) return;

    this.publishing = true;
    try {
      let next: ApprovalEvent | undefined;
      while ((next = this.events.shift())) this.emit(structuredClone(next));
    } finally {
      this.publishing = false;
    }
  }
}
