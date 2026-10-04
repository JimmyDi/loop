# Session Events

Coding sessions forward the five [Agent events](../../agent/docs/events.md) and add run_timing, agent_settled, session_title, permission_changed, approval_requested and approval_resolved. Consumers send commands through instance methods and receive results through subscriptions.

## Subscribe

Given an existing session:

```typescript
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }

  if (event.type === "agent_settled") {
    console.log("\nOutcome:", session.state.outcome);
  }
});

try {
  await session.prompt("Hello!");
} finally {
  unsubscribe();
}
```

See the full [SDK sample](../sdk.sample.ts) for construction and cleanup. It only prints text deltas, so waiting and tool-only turns can be silent; the CLI separately renders activity status.

## Event reference

| Event | Use |
| --- | --- |
| `message_start` | Begin a message or assistant draft. |
| `message_update` | Consume the original Pi AI update carried in `assistantMessageEvent`. |
| `message_end` | Display a completed message; this is not a disk-save acknowledgement. |
| `tool_execution_start` | Show the tool name/call ID and pending execution. |
| `tool_execution_end` | Show the matching result and `isError`. |
| `run_timing` | Upsert `timing: SessionRunTiming` by `userMessageIndex`. The start has `startedAt`; the finish also has `finishedAt`. |
| `agent_settled` | An accepted prompt's execution and save attempt have finished. Inspect outcome and pending-save state. |
| `session_title` | Title display changed or generation failed; carries title and optional error. May arrive after a run settles. |
| permission_changed | Managed permission selection saved; carries permissionPreset. No prompt run ID is needed. |
| `approval_requested` | Carries the approval request snapshot. Can occur outside a prompt and may resolve immediately. |
| `approval_resolved` | Carries the request and final outcome in `result`; removes the matching pending request. |

Approval events are paired by request ID, including unavailable, rejected and cancelled outcomes. A normal event subscription does not make approval available: a trusted host must explicitly register an interaction handler. See [approvals](approvals.md) for registration, decision submission, timeout and lifecycle behavior.

The initial fallback title is published immediately and again after saving; a title event alone is not a history-save acknowledgement. Title errors are exposed separately in `state.titleError` and never change the main run outcome. See [session titles](session-titles.md).

`agent_settled` fires for accepted prompts even when model preflight fails. Validation failures before acceptance, such as a concurrent prompt, do not start a run or emit it. Model switching and flushing do not emit prompt lifecycle events.

The starting `run_timing` is emitted immediately before the user `message_start`, using the prompt acceptance time. The finished timing is emitted after execution ends and before the history save attempt, including errors and cancellation. A preflight failure before a user message emits no timing event. These events are not save acknowledgements; use `agent_settled` and `hasPendingSave` for persistence state. Snapshots expose the same metadata in `state.runTimings`. See [execution timing](sessions.md#execution-timing).

## Completed messages and drafts

`state.messages` is completed history; `state.draft` is the current assistant partial. Draft state clears at assistant completion and run finalization. Do not append every delta into a persistent message list.

`agent_settled` means stopped, not necessarily successful or saved. `state.outcome` is `success`, `error`, or `cancelled` after finalization; `hasPendingSave` reports retained unsaved history. `prompt()` still rejects on failure, so handle its promise as well as events.

## Listener isolation

Each session listener receives its own cloned event. Session callbacks are invoked synchronously, but returned promises are not awaited. Thrown/rejected listener errors are recorded in `state.listenerErrors` without failing the run. That list is cumulative for the session; asynchronous listener work can finish after `prompt()` settles.

Subscriptions belong to one session instance. Rebind them when [AgentSessionRuntime](sessions.md#replace-the-active-session) replaces that instance. Unsubscribe when the host no longer needs updates.

## Source

[session types](../core/types/session.ts), [agent-session.ts](../core/agent-session.ts), [agent-session.test.ts](../core/agent-session.test.ts), and [interactive output](../modes/interactive/interactive-output.ts).
