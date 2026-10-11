# Message Queue and Resume

A session accepts follow-up inputs while its current task runs. coding-agent owns the editable queue; Agent consumes steering and follow-up callbacks inside its complete model/tool loop.

## Usage

Given an existing session:

```typescript
const running = session.prompt("Inspect the module");
const id = session.enqueue("Check affected tests");
session.editQueued(id, "Check tests and explain failures");
session.steerQueued(id);
await running;
await session.waitForIdle();
```

Subscribe to queue_changed and read session.state for authoritative queue, running and resume state. waitForIdle waits through automatic queue draining; inspect outcome and hasPendingSave to determine success.

## API

| Method or state | Contract |
| --- | --- |
| enqueue(content, { skills?, id? }?) | Validate and clone native text/image content, append an item, return its ID; start immediately if idle and unpaused. |
| beginQueuedEdit(id) | Hold an existing item out of scheduling without changing its position. |
| cancelQueuedEdit(id) | Release the hold with the original content; resume draining when allowed. |
| editQueued(id, content, skills?) | Replace content, optionally replace selected Skills and release its hold without changing ID; append to the queue if a later item was dispatched during editing, otherwise retain the reserved position. |
| moveQueued(id, beforeId?) | Move before an existing item; omit beforeId to move to the end. |
| deleteQueued(id) | Remove an unconsumed item. |
| steerQueued(id) | Mark an item for the next model boundary; when idle or paused, start immediately. |
| abort() | Cancel generation and approvals, await cleanup/save; retain queued inputs and pause automatic draining. |
| resume() | Continue the stopped task from completed history, then drain follow-ups. Reject if unavailable, busy or awaiting save. |
| state.queue | Cloned ordered QueuedMessage array: id, content, skills, steering and optional editing. |
| state.canResume | A stopped task has a retained continuation. |

Only enqueue accepts a new message ID. Edits, moves and deletions of consumed or missing IDs reject without recreating messages. Editing or deleting an item already marked for steering rejects until its boundary is reached.

## Scheduling

Ordinary inputs run FIFO after the task finishes without tool calls. A steering input runs after the current response and entire sequential tool batch finish, before another model request. Selection does not cancel tools, skip calls or interrupt a stream. Multiple selected items follow queue order. Each selected user message refreshes its Skills, system prompt and ready tools before the loop appends it. Queue selection is rechecked after asynchronous preparation and saving so edits, deletion and reordering remain effective. An item is removed only after preparation and the preceding history/timing checkpoint succeed.

Items marked editing are skipped when their turn arrives; later runnable messages continue in queue order. If every item is being edited, the session becomes idle without consuming them. Saving makes that item eligible again. If a message after it was dispatched during editing, saving appends the edited item after all remaining and newly queued messages; otherwise it keeps its reserved position. Dispatch includes ordinary draining and steering, without waiting for generation to finish. Dispatching an earlier item or deleting a later item does not count as bypassing the edit. Cancel releases the original content at the same position and clears the bypass record for subsequent edits. A currently running message finishes first. Invalid edits keep the hold. Steering a held item rejects. Holds are server-owned, survive browser navigation/reconnect, and remain until saved, cancelled or deleted; reconnecting hosts can reopen editing by the same ID.

AgentSession.run calls agent.prompt(content) or agent.continue() once. AgentLoopOptions.getSteeringMessages and getFollowUpMessages read MessageQueue through peek/take; prepareRequest supplies the prepared request configuration. finishTurn saves each completed response and sequential tool batch before queue polling. Ordinary queue messages are follow-ups, consumed one at a time. The session stays busy throughout; agent_settled occurs only after the complete run ends. Each dispatched user input and resumed attempt retains a separate prompt timing.

The Agent enforces maxTurns across requests within one running invocation. A reached budget never consumes an additional queue item; a naturally completed response can settle before the session starts remaining work in a new invocation. A tool continuation that exhausts the limit fails and halts draining. Every model request, including tool continuation, steering and queued work, passes through the configured runtime's budget and automatic compaction preparation.

Stop acts through cancellation signals. Completed tool results remain in history; interrupted or skipped calls retain error results. Resume requests another response from that history without duplicating the user message or replaying successful calls. If Stop occurred before input was appended, Resume submits the retained original input once. On explicit Stop, coding-agent saves the visible text from an interrupted draft as an aborted assistant message, excluding unfinished tool calls and thinking. The native model input normalizer excludes aborted messages on replay; Resume may regenerate text. Each attempt keeps its own duration and history range, and the Web view shows it as a separate response. Queue and continuation state remain memory-only. A model may choose new tool calls when continuing; cancellation cannot undo earlier effects. Tools must cooperate with cancellation.

The explicit prompt API retains its idle-only contract. Calling it after cancellation begins a new task and clears the retained continuation; use resume to continue or enqueue to preserve queue ordering.

## Lifecycle and Limits

Queues and continuations are in memory in the session instance. Browser refresh and reconnect recover them from the live server. Closing/replacing the instance or restarting the server discards them; JSONL stores completed history, not queue metadata or stream cursors.

Generation or save errors halt draining and retain unconsumed items. Flush repairs a pending save without generating or rerunning tools; Resume remains available for stopped work after successful flush. Idle Steer or a new enqueue can restart retained queued work after an error. Queue edits and moves remain possible during pending save, while new inputs and execution are blocked.

Full message and attachment bodies remain in memory. There is no queue size cap, automatic retry, cross-process scheduling or rollback. Listener failures remain isolated.

## Source and Tests

- [MessageQueue](../core/message-queue.ts) and [tests](../core/message-queue.test.ts).
- [Input preparation](../core/context/session-input.ts) and [tests](../core/context/session-input.test.ts).
- [AgentSession](../core/agent-session.ts) and [integration tests](../core/agent-session.test.ts).
- [Events](events.md), [sessions](sessions.md), [Agent continuation API](../../../agent/src/docs/agent.md).
