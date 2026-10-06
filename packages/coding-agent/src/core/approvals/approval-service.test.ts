import { expect, vi, test } from "vitest";

import { ApprovalService } from "./approval-service";
import type { ApprovalEvent, ApprovalHandler, ApprovalRequest } from "./types";

const input = { toolName: "write", toolCallId: "test-call", reason: "Review this operation" };

const response = (request: ApprovalRequest, decision = "allowed-once" as const) => ({
  requestId: request.requestId,
  sessionId: request.sessionId,
  decision,
});

test("requests have isolated snapshots and accept exactly one matching decision", async () => {
  const events: ApprovalEvent[] = [];
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    (event) => events.push(event),
  );
  let delivered: ApprovalRequest | undefined;
  service.registerHandler((request) => {
    delivered = request;
  });
  const mutable = { ...input };
  const waiting = service.request(mutable);
  mutable.reason = "changed";
  const request = service.pending[0]!;
  expect(request).toMatchObject({ ...input, sessionId: "test-session", policy: "ask" });
  expect(request.expiresAt).toBeNull();
  Object.assign(request, { toolName: "changed" });
  Object.assign(delivered!, { toolCallId: "changed" });
  expect(service.pending[0]).toMatchObject(input);
  expect(service.respond({ ...response(request), sessionId: "other-session" })).toBe(false);
  expect(service.respond({ ...response(request), requestId: "unknown-request" })).toBe(false);
  expect(service.respond({ ...response(request), decision: "always" } as never)).toBe(false);
  expect(service.respond(response(request))).toBe(true);
  expect(service.respond(response(request))).toBe(false);
  expect(await waiting).toMatchObject({ request: input, outcome: "allowed-once" });
  expect(service.pending).toEqual([]);
  expect(events.map((event) => event.type)).toEqual(["approval_requested", "approval_resolved"]);
  const next = service.request(input);
  const nextRequest = service.pending[0]!;
  expect(nextRequest.requestId).not.toBe(request.requestId);
  expect(service.respond(response(request))).toBe(false);
  expect(service.respond({ ...response(nextRequest), decision: "rejected" })).toBe(true);
  expect((await next).outcome).toBe("rejected");
  service.dispose();
});

test("operation arguments and scope are copied on input, delivery, state and result", async () => {
  const service = new ApprovalService(
    "test",
    () => "ask",
    () => {},
  );
  let delivered: ApprovalRequest | undefined;
  service.registerHandler((request) => {
    delivered = request;
  });
  const operation = {
    kind: "file-write" as const,
    arguments: { edits: [{ oldText: "old", newText: "new" }] },
    workspaceRoot: ".",
    targetPath: "file",
    beforeSha256: null,
    afterSha256: "test-digest",
  };
  const waiting = service.request({ ...input, operation });
  operation.arguments.edits[0]!.newText = "input mutation";
  if (delivered?.operation?.kind === "file-write") delivered.operation.targetPath = "other";
  const request = service.pending[0]!;
  if (request.operation) request.operation.arguments.edits = [];
  service.respond(response(request));
  expect((await waiting).request.operation).toMatchObject({
    targetPath: "file",
    arguments: { edits: [{ oldText: "old", newText: "new" }] },
  });
  service.dispose();
});

test("never and missing handlers fail closed even when observers attempt approval", async () => {
  for (const policy of ["ask", "never"] as const) {
    const events: ApprovalEvent[] = [];
    let deliveries = 0;
    const service = new ApprovalService(
      "test-session",
      () => policy,
      (event) => {
        events.push(event);
        if (event.type === "approval_requested")
          expect(service.respond(response(event.request))).toBe(false);
      },
    );
    if (policy === "never")
      service.registerHandler(() => {
        deliveries++;
      });
    const result = await service.request(input);
    expect(result.outcome).toBe(policy === "ask" ? "unavailable" : "rejected");
    expect(events).toHaveLength(2);
    expect(deliveries).toBe(0);
    expect(service.pending).toEqual([]);
    service.dispose();
  }
});

test("missing, throwing, rejecting and invalid handlers never authorize", async () => {
  const handlers: ApprovalHandler[] = [
    () => {
      throw new Error("delivery failed");
    },
    async () => {
      throw new Error("delivery failed");
    },
    (() => "allowed-once") as unknown as ApprovalHandler,
    (async () => ({ decision: "allowed-once" })) as unknown as ApprovalHandler,
  ];
  for (const handler of handlers) {
    const service = new ApprovalService(
      "test-session",
      () => "ask",
      () => {},
    );
    service.registerHandler(handler);
    expect((await service.request(input)).outcome).toBe("unavailable");
    expect(service.pending).toEqual([]);
    service.dispose();
  }
});

test("detaching a handler drains pending requests and cannot detach its replacement", async () => {
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    () => {},
  );
  const detach = service.registerHandler(() => {});
  expect(() => service.registerHandler(() => {})).toThrow("already registered");
  const waiting = [service.request(input), service.request(input)];
  const requests = service.pending;
  detach();
  expect((await Promise.all(waiting)).map((result) => result.outcome)).toEqual([
    "unavailable",
    "unavailable",
  ]);
  for (const request of requests) expect(service.respond(response(request))).toBe(false);
  service.registerHandler((request) => {
    service.respond(response(request));
  });
  detach();
  expect((await service.request(input)).outcome).toBe("allowed-once");
  service.dispose();
});

test("cancellation and disposal discard late responses and settle once", async () => {
  const events: ApprovalEvent[] = [];
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    (event) => events.push(event),
  );
  const controller = new AbortController();
  const delivery = Promise.withResolvers<void>();
  service.registerHandler(() => delivery.promise);
  const waiting = service.request(input, { signal: controller.signal });
  const request = service.pending[0]!;
  controller.abort();
  expect((await waiting).outcome).toBe("cancelled");
  expect(service.respond(response(request))).toBe(false);
  delivery.reject(new Error("late error"));
  await Promise.resolve();
  expect(events.filter((event) => event.type === "approval_resolved")).toHaveLength(1);
  const preCancelled = await service.request(input, { signal: controller.signal });
  expect(preCancelled.outcome).toBe("cancelled");
  const pending = service.request(input);
  const disposedRequest = service.pending[0]!;
  service.dispose();
  service.dispose();
  expect((await pending).outcome).toBe("cancelled");
  expect(service.respond(response(disposedRequest))).toBe(false);
  expect((await service.request(input)).outcome).toBe("unavailable");
  expect(() => service.registerHandler(() => {})).toThrow("disposed");
  expect(service.pending).toEqual([]);
});

test("default and explicit indefinite requests still accept one decision after a day of waiting", async () => {
  vi.useFakeTimers();
  const events: ApprovalEvent[] = [];
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    (event) => events.push(event),
  );
  service.registerHandler(() => {});
  try {
    for (const options of [{}, { timeoutMs: null }]) {
      const waiting = service.request(input, options);
      const request = service.pending[0]!;
      expect(request.expiresAt).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      const count = events.length;
      vi.advanceTimersByTime(86_400_000);
      await Promise.resolve();
      expect(events).toHaveLength(count);
      expect(service.pending).toEqual([request]);
      expect(service.respond(response(request))).toBe(true);
      expect((await waiting).outcome).toBe("allowed-once");
      expect(service.respond(response(request))).toBe(false);
    }
  } finally {
    service.dispose();
    vi.useRealTimers();
  }
});

test("explicit timeouts fail closed even when a response arrives before an overdue timer callback", async () => {
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    () => {},
  );
  service.registerHandler(() => {});
  const waiting = service.request(input, { timeoutMs: 5 });
  const request = service.pending[0]!;
  expect(request.expiresAt).toBe(request.createdAt + 5);
  expect((await waiting).outcome).toBe("timed-out");
  expect(service.respond(response(request))).toBe(false);
  const delayed = service.request(input, { timeoutMs: 5 });
  const overdue = service.pending[0]!;
  const stopAt = performance.now() + 10;
  while (performance.now() < stopAt) {
    /* Simulate an occupied event loop. */
  }
  expect(service.respond(response(overdue))).toBe(false);
  expect((await delayed).outcome).toBe("timed-out");
  expect(service.pending).toEqual([]);
  service.dispose();
});

test("invalid requests reject before publishing or retaining pending state", async () => {
  const events: ApprovalEvent[] = [];
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    (event) => events.push(event),
  );
  for (const timeoutMs of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])
    await expect(service.request(input, { timeoutMs })).rejects.toThrow("timeout");
  for (const field of ["toolName", "toolCallId", "reason"])
    await expect(service.request({ ...input, [field]: " " })).rejects.toThrow("requires");
  expect(service.pending).toEqual([]);
  expect(events).toEqual([]);
  service.dispose();
});

test("reentrant decisions preserve event order and cancellation drains reentrant requests", async () => {
  const events: ApprovalEvent[] = [];
  let nested: Promise<unknown> | undefined;
  const service = new ApprovalService(
    "test-session",
    () => "ask",
    (event) => {
      events.push(event);
      if (event.type === "approval_resolved" && event.result.outcome === "cancelled" && !nested) {
        nested = service.request(input);
      }
    },
  );
  service.registerHandler(() => {});
  const waiting = service.request(input);
  service.cancelPending();
  expect((await waiting).outcome).toBe("cancelled");
  expect(await nested).toMatchObject({ outcome: "cancelled" });
  expect(events.map((event) => event.type)).toEqual([
    "approval_requested",
    "approval_resolved",
    "approval_requested",
    "approval_resolved",
  ]);
  expect(service.pending).toEqual([]);
  service.dispose();
});

test("bulk cancellation and handler removal reject reentrant approval of another request", async () => {
  for (const action of ["cancel", "detach", "dispose"] as const) {
    let second: ApprovalRequest | undefined;
    const accepted: boolean[] = [];
    const service = new ApprovalService(
      "test-session",
      () => "ask",
      (event) => {
        if (event.type === "approval_resolved" && second) {
          const request = second;
          second = undefined;
          accepted.push(service.respond(response(request)));
        }
      },
    );
    const detach = service.registerHandler(() => {});
    const first = service.request(input);
    const next = service.request(input);
    second = service.pending[1]!;
    if (action === "cancel") service.cancelPending();
    else if (action === "detach") detach();
    else service.dispose();
    const outcome = action === "detach" ? "unavailable" : "cancelled";
    expect((await first).outcome).toBe(outcome);
    expect((await next).outcome).toBe(outcome);
    expect(accepted).toEqual([false]);
    expect(service.pending).toEqual([]);
    service.dispose();
  }
});

test("session grants cannot be submitted for file operations or through forged approval responses", async () => {
  const service = new ApprovalService(
    "session",
    () => "ask",
    () => {},
  );
  service.registerHandler(() => {});
  const pending = service.request({ toolName: "write", toolCallId: "call", reason: "test" });
  const request = service.pending[0]!;
  expect(service.respond({ ...request, decision: "allowed-session" })).toBe(false);
  expect(service.respond({ ...request, sessionId: "other", decision: "allowed-once" })).toBe(false);
  expect(service.respond({ ...request, decision: "allowed-once" })).toBe(true);
  await pending;
  expect(service.respond({ ...request, decision: "allowed-session" })).toBe(false);
  service.dispose();
});
