# Streaming State

The frontend receives session updates through a same-origin EventSource. HTTP queries provide initial snapshots; SSE continues with activity, message, and tool events. There is no direct connection from the browser to the model service.

## Loading and Subscribing

ChatWorkspace first requests `/api/sessions/:id`. After it succeeds, useSessionEvents connects to `/api/sessions/:id/events` and passes frames to session-store. Components read the latest display snapshot instead of maintaining separate message histories.

| Frame type | Display behavior |
| --- | --- |
| session.snapshot | Initialize or completely replace current state |
| session.state | Synchronize completion, model changes, or save state from a server snapshot |
| run.accepted | Record the accepted requestId/runId and running state |
| loop.event | Update drafts, completed messages, and tool cards by message position |

loop.event preserves the native coding-agent event contract, including the Pi AI event inside message_update. The projection replaces drafts with the cumulative message in the event. Do not append that cumulative text again or add the same final message to history twice. run_timing events upsert state.runTimings by userMessageIndex, supplying server start/finish timestamps for the execution-section timer. Full snapshots restore that metadata without resetting elapsed time.

## Reconnection and Deduplication

The snapshot's optional draftPhase tracks thinking, thinking-complete, text or tool from Pi AI content events. The execution icon can finish on thinking_end before answer text starts, and resume for later thinking or tool calls. New assistant messages and completed drafts clear that phase. This is transient display state; it does not alter saved conversation messages.

Each view records a streamId/seq cursor. Duplicate frames are ignored. A sequence gap or changed stream in incremental frames closes the connection and requests a full snapshot. Older snapshots behind the current cursor in the same stream are ignored.

After a network error, mark the view disconnected and reconnect with its cursor after about 1.5 seconds. Parse errors request a fresh snapshot. Existing content remains visible while disconnected, but normal sending and model switching are disabled. See [the SSE service](../../backend/docs/events.md) for replay limits.

Switching sessions closes only the previous view's EventSource. Backend sessions continue, and reopening synchronizes their latest results. Session snapshots/state frames update the open conversation and its header title, including asynchronous title updates that preserve the current operation.

## List Synchronization

AppShell mounts useListEvents once per page, connecting to `/api/workspaces/events`. This subscription stays open when switching sessions. The backend watches all loaded sessions, allowing background generation status and late titles to update every connected page without five-second polling. Project and archive changes use the same stream.

sessions.changed invalidates the affected project's session query and archived chats. projects.changed also invalidates the project list. lists.reset invalidates all three list caches. Active queries refetch; collapsed or unmounted lists remain stale until used. A 50ms window coalesces bursts of notifications; token deltas do not produce list events. This is change-driven batching, not a periodic refresh.

Before invalidating, the hook cancels older in-flight list requests using AbortSignal. Notifications arriving during a refresh are retained for another batch, preventing a stale response from swallowing a newer change. Native EventSource reconnects automatically, and every connection begins with lists.reset. Duplicate incremental frames are ignored; sequence gaps, changed stream identities or malformed JSON force a full list refresh. Unmount closes the connection and cancels pending batches.

The list stream does not change the selected conversation or discard unsent drafts on other pages. It covers this Web process's changes; external CLI or filesystem edits require a reload.

## Boundaries

session-store is held only in memory; refreshing relies on the server for recovery. SSE reconnection does not resubmit prompts or guarantee exactly-once execution across server restarts. [Chat input](chat.md) handles unconfirmed submissions separately.

## Source and Tests

- [ChatWorkspace](../components/chat/ChatWorkspace.tsx) / [tests](../components/chat/ChatWorkspace.test.tsx).
- [useSessionEvents](../hooks/useSessionEvents.ts) / [tests](../hooks/useSessionEvents.test.tsx).
- [useListEvents](../hooks/useListEvents.ts) / [batching and reconnection tests](../hooks/useListEvents.test.tsx).
- [session-store](../state/session-store.ts) / [tests](../state/session-store.test.ts).
- [Shared protocol](../../shared/protocol.ts), [message projection](../../shared/session-projection.ts) / [tests](../../shared/session-projection.test.ts).
