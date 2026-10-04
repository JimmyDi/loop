# Approval Requests

Coding-agent core owns short-lived approval requests. A trusted host registers one interaction handler, receives a request, and submits a decision through the session API. The model does not assign approval outcomes or call an approval tool. Ordinary event subscriptions do not count as an available interaction handler.

This implementation provides the request lifecycle independently of a UI. Built-in tool escalation is not connected yet: an allowed-once result records a decision for one request, does not execute a tool, and does not expand the session's permission preset.

## Minimal usage

From the repository root, with model configuration available, this example exercises a deterministic host rejection without making a model request or executing a tool:

```typescript
import { createAgentSession, SessionManager } from "./src/coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  tools: [],
  permissionPreset: "read-only",
});
const detach = session.registerApprovalHandler((request) => {
  // A human-facing adapter can display the request and submit the decision later.
  session.respondToApproval({
    sessionId: request.sessionId,
    requestId: request.requestId,
    decision: "rejected",
  });
});

try {
  const result = await session.requestApproval(
    { toolName: "write", toolCallId: "example-call", reason: "Review the proposed operation" },
    { timeoutMs: 30_000 },
  );
  console.log(result.outcome);
} finally {
  detach();
  await session.abort();
  session.dispose();
}
```

## API

| API | Contract |
| --- | --- |
| `session.requestApproval(input, options?)` | Returns `Promise<ApprovalResult>`. Input requires nonempty `toolName`, `toolCallId`, and `reason`. These identify a proposed operation; they do not prove its arguments or execution scope. |
| `options.signal` | Optional caller cancellation, combined with the active run's cancellation signal. |
| `options.timeoutMs` | Positive integer up to 2,147,483,647 milliseconds. Defaults to `DEFAULT_APPROVAL_TIMEOUT_MS`, 120,000 milliseconds. |
| `session.registerApprovalHandler(handler)` | Registers the single host interaction handler and returns an idempotent detach function. A second registration rejects until the first detaches. |
| `ApprovalHandler` | Receives an isolated `ApprovalRequest` snapshot; returns void or a promise of void. Returning from delivery does not approve anything. Submit decisions separately. |
| `session.respondToApproval(response)` | Requires `sessionId`, `requestId`, and `decision`: `allowed-once` or `rejected`. Returns true only for an accepted first decision. |
| `session.state.pendingApprovals` | Fresh snapshots of current requests; an empty array when none remain. Optional in the shared state type for compatibility with existing consumers. |

Requests have a generated `requestId`, the owning `sessionId`, the input fields, the effective `policy`, and Unix-millisecond `createdAt`/`expiresAt` timestamps. The result contains the original request snapshot, `outcome`, and `resolvedAt`. Timeout enforcement uses elapsed monotonic time so delayed timer delivery cannot accept an expired response.

Public exports include `ApprovalInput`, `ApprovalRequestOptions`, `ApprovalRequest`, `ApprovalResponse`, `ApprovalDecision`, `ApprovalOutcome`, `ApprovalResult`, `ApprovalHandler`, `ApprovalEvent`, and `DEFAULT_APPROVAL_TIMEOUT_MS`. The underlying service is internal to coding-agent core.

## Outcomes and events

| Outcome | Meaning |
| --- | --- |
| `allowed-once` | The host accepted this particular pending request. No persistent grant is created. |
| `rejected` | The host rejected it, or effective policy is `never`. |
| `cancelled` | The caller/run aborted, the run ended with a request still pending, or the session was disposed. |
| `timed-out` | The request deadline elapsed without an accepted response. |
| `unavailable` | No handler exists, it detached, or delivery threw, rejected, or returned an invalid value before settlement. |

Every valid accepted request emits `approval_requested` with `request`, followed by exactly one `approval_resolved` with `result`, including immediate refusal. Missing handlers and `never` cannot be bypassed by a response from an ordinary event listener. Managed restricted presets use `ask`; full access uses `never`, meaning do not ask for additional authority, not automatic approval. Custom-tool sessions use `ask` without claiming managed enforcement.

Events and handler payloads are isolated snapshots. Listener failures are recorded through the existing [session event](events.md) error handling and cannot authorize a request. Nested synchronous responses preserve requested-before-resolved ordering for all session observers. A registered handler that does not answer expires at the deadline. It can watch the resolved event to dismiss an outstanding interaction.

Unknown IDs, wrong-session IDs, duplicate decisions, invalid decisions, and late responses return false. First settlement wins; a delivery error or cancellation after an already accepted decision cannot rewrite it. Invalid request fields/timeouts and requests on disposed sessions reject their promise before emitting events.

## Session lifecycle

Requests can be made while idle or during an active prompt. Idle requests do not mark the model as running. Pending requests block starting another prompt, changing model/preset/title, flushing, or reserving a session for replacement. Requests during other session operations or save finalization reject.

`abort()` cancels pending requests as well as the active run. Run finalization drains any requests the caller did not await, before saving and publishing `agent_settled`. Idle `dispose()` cancels requests before clearing listeners; busy sessions still require `await session.abort()` first. Runtime replacement requires pending work to be cancelled or settled, and runtime disposal aborts before disposing.

`waitForIdle()` waits for model/session operations, not standalone idle approval requests. Await the request promise to wait for its decision, or call `abort()` to cancel it.

Requests, decisions, and handlers are never written into conversation history, runtime context, or session storage. Reopening a session starts with no pending approval, no remembered allow-once decision, and no handler. Rebind the handler to the replacement instance.

## Limits

- Built-in write/edit/bash still reject operations requiring additional authority. They do not yet issue these requests, consume allowed-once decisions, or retry commands. See [permissions](permissions.md).
- Tool argument/scope binding and one-operation execution enforcement are not part of this interaction layer. Hosts must not treat request metadata or a result object as an execution capability.
- Web snapshots project approval state and events, but Web/CLI approval controls and an authenticated decision route are not implemented. A viewer or event connection alone cannot answer.
- Handler registration and response submission are trusted host APIs. Request IDs correlate decisions; they are not authentication credentials.
- Pending state and events are in memory, without durable approval audit history.

## Source and validation

[Service](../core/approvals/approval-service.ts) / [tests](../core/approvals/approval-service.test.ts), [types](../core/approvals/types.ts), [session integration](../core/agent-session.ts) / [tests](../core/agent-session.test.ts), and [Web projection](../../web-ui/shared/session-projection.ts) / [tests](../../web-ui/shared/session-projection.test.ts). Tests use synthetic operations and model streams without real model requests.
