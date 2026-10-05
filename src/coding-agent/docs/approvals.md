# Approval Requests

Coding-agent core owns short-lived approval requests. A trusted host registers one interaction handler, receives a request, and submits a decision through the session API. The model does not assign approval outcomes or call an approval tool. Ordinary event subscriptions do not count as an available interaction handler.

Managed built-in tools use this lifecycle before operations that need additional authority. An allowed-once decision resumes only the waiting call with its captured arguments and scope, without changing the session preset. Calling requestApproval directly still only returns a decision; it does not schedule or execute a tool.

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
| `input.operation` | Optional `ApprovalOperation` snapshot. Managed tools supply their validated arguments and the execution scope described below. Host-created metadata is not an execution capability. |
| `options.signal` | Optional caller cancellation, combined with the active run's cancellation signal. |
| `options.timeoutMs` | Positive integer up to 2,147,483,647 milliseconds. Defaults to `DEFAULT_APPROVAL_TIMEOUT_MS`, 120,000 milliseconds. |
| `session.registerApprovalHandler(handler)` | Registers the single host interaction handler and returns an idempotent detach function. A second registration rejects until the first detaches. |
| `ApprovalHandler` | Receives an isolated `ApprovalRequest` snapshot; returns void or a promise of void. Returning from delivery does not approve anything. Submit decisions separately. |
| `session.respondToApproval(response)` | Requires `sessionId`, `requestId`, and `decision`: `allowed-once` or `rejected`. Returns true only for an accepted first decision. |
| `session.state.pendingApprovals` | Fresh snapshots of current requests; an empty array when none remain. Optional in the shared state type for compatibility with existing consumers. |

Requests have a generated `requestId`, the owning `sessionId`, the input fields, the effective `policy`, and Unix-millisecond `createdAt`/`expiresAt` timestamps. The result contains the original request snapshot, `outcome`, and `resolvedAt`. Timeout enforcement uses elapsed monotonic time so delayed timer delivery cannot accept an expired response.

Public exports include `ApprovalInput`, `ApprovalOperation`, `ApprovalRequestOptions`, `ApprovalRequest`, `ApprovalResponse`, `ApprovalDecision`, `ApprovalOutcome`, `ApprovalResult`, `ApprovalHandler`, `ApprovalEvent`, and `DEFAULT_APPROVAL_TIMEOUT_MS`. The underlying service is internal to coding-agent core.

## Managed tool execution

The core observes each sequential tool-start event to bind the actual tool call ID, then captures the validated arguments before execution. The execution context allows one approval request and expires when that call ends. Neither a model-supplied request ID nor an allowed-once result passed as a tool argument can create authority. The lower Agent loop remains unchanged.

| Operation kind | Review data and approved scope |
| --- | --- |
| `file-write` | Validated write/edit arguments, canonical workspace and target path, and before/after SHA-256 digests. Allows one exact replacement, including required parent-directory creation and a temporary sibling for atomic replacement. A null before digest means the target did not exist. |
| `shell-unrestricted` | Validated command arguments and canonical cwd, with filesystem, network and environment explicitly set to host. Allows one unsandboxed Bash invocation and its descendants with host-user access, including normally protected storage. It does not confine the command to paths mentioned in its text. |

Write and edit automatically request approval when read-only or outside-workspace policy denies the target. Protected Loop storage and non-regular files remain hard denials for file tools. Edit validates its exact replacements against the original file before asking. A private permit binds the resulting content and path, is consumed once, and rechecks the target, original file identity/content, existing parent identity and preset after waiting and before replacement. Changes invalidate approval instead of silently approving a different edit.

Bash stays sandboxed by default. A call requesting `sandbox_permissions: "require_escalated"` must include a nonempty `justification`; approval happens before launching any command. Its scope is full host-user filesystem, network and environment access for that invocation. Full-access sessions already have this authority and do not ask again. Standalone restricted tool factories have no session approval context and reject escalation.

Rejected, unavailable, timed-out or cancelled requests produce tool errors without starting the requested mutation or shell command. A command that fails after dispatch is never automatically replayed or retried with broader permissions, since it may have partial effects. A new tool call always has a new execution context and cannot reuse an earlier decision. Existing process-group cancellation, command timeout and output truncation remain in effect.

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

Pending request records, execution permits and handler registrations are never persisted. Reopening a session starts with no pending approval, no reusable allow-once decision, and no handler. Ordinary tool calls and results remain in conversation history, including escalation arguments and denial messages; these historical records cannot grant authority. Rebind the handler to the replacement instance.

## Limits

- The approval service returns decisions; managed execution keeps its permits privately. Hosts must not treat arbitrary request metadata or a result object as an execution capability. See [permissions](permissions.md).
- File checks narrow filesystem races but cannot eliminate concurrent changes by other host processes between a check and a syscall. Approved Bash is intentionally unsandboxed; its command text does not prove or constrain all effects.
- Web snapshots project approval state and events, but Web/CLI approval controls and an authenticated decision route are not implemented. A viewer or event connection alone cannot answer.
- Handler registration and response submission are trusted host APIs. Request IDs correlate decisions; they are not authentication credentials.
- Pending state and events are in memory, without durable approval audit history.

## Source and validation

[Service](../core/approvals/approval-service.ts) / [tests](../core/approvals/approval-service.test.ts), [types](../core/approvals/types.ts), [session integration](../core/agent-session.ts) / [tests](../core/agent-session.test.ts), and [Web projection](../../web-ui/shared/session-projection.ts) / [tests](../../web-ui/shared/session-projection.test.ts). Tests use synthetic operations and model streams without real model requests.

[Tool binding](../core/approvals/tool-approvals.ts) / [integration tests](../core/approvals/tool-approvals.test.ts), [file approvals](../core/permissions/file-approval.ts) / [tests](../core/permissions/file-approval.test.ts), and [shell approvals](../core/permissions/shell-approval.ts) / [tests](../core/permissions/shell-approval.test.ts).
