# Cancellation and Errors

A successful `prompt()` returns the final Pi AI assistant message. Failures reject the promise; Agent always clears its running state in `finally`.

## Cancel a run

Each prompt has an independent `AbortController`. `agent.abort()` signals it and returns immediately. Observe the rejected prompt promise before starting another prompt.

The signal reaches Pi AI and local tools. The loop checks it before each model request and tool execution. Waiting for stream acquisition, iterator events, and the final result is abortable. Tool execution must cooperate with the signal; there is no forced interruption of arbitrary local code.

## Completion rules

| Condition | Behavior |
| --- | --- |
| `stop` or `toolUse` without calls | Return the final assistant. |
| `stop` or `toolUse` with calls | Execute the batch and continue. |
| `error` or `aborted` | Reject and execute no tools from that response. |
| `length` | Reject as truncated; do not execute potentially incomplete calls. |
| `deferred` or `pending` | Reject as unsupported; no polling. |
| Reached `maxTurns` | Reject before another model request; never silently report success. |
| Tool lookup, validation, or execution failure | Append an error tool result and let the model continue unless cancelled. |
| Unexpected stream or listener exception | Reject and release running state. |

Errors use ordinary `Error` values, including a provider's `errorMessage` where available. There is no exported structured error-code hierarchy; inspect the failure and completed history rather than assuming every failure has a particular string.

## History after failure

Completed messages remain accessible through `agent.messages`. Draft deltas are not appended individually. A provider error/aborted assistant may appear in display history; Pi AI normalization filters such messages before the next model request.

When an assistant's batch is interrupted, the loop adds error results for calls not completed, preserving IDs. It does not execute skipped calls or start another model request. Error/aborted assistants are excluded from this pairing because Pi AI removes them on replay.

History retention does not undo tool side effects. For durable session snapshots and storage failures, use [coding-agent sessions](../../coding-agent/docs/sessions.md).

## Source

[agent.ts](../agent.ts), [agent-loop.ts](../agent-loop.ts), and cancellation cases in [agent.test.ts](../agent.test.ts).
