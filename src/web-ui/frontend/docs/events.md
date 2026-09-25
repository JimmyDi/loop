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

loop.event preserves the native coding-agent event contract, including the Pi AI event inside message_update. The projection replaces drafts with the cumulative message in the event. Do not append that cumulative text again or add the same final message to history twice.

## Reconnection and Deduplication

Each view records a streamId/seq cursor. Duplicate frames are ignored. A sequence gap or changed stream in incremental frames closes the connection and requests a full snapshot. Older snapshots behind the current cursor in the same stream are ignored.

After a network error, mark the view disconnected and reconnect with its cursor after about 1.5 seconds. Parse errors request a fresh snapshot. Existing content remains visible while disconnected, but normal sending and model switching are disabled. See [the SSE service](../../backend/docs/events.md) for replay limits.

Switching or closing tabs closes only that view's EventSource. Backend sessions continue, and reopening synchronizes their latest results. An idle session.state invalidates session-list queries to refresh history metadata.

## Boundaries

session-store is held only in memory; refreshing relies on the server for recovery. SSE reconnection does not resubmit prompts or guarantee exactly-once execution across server restarts. [Chat input](chat.md) handles unconfirmed submissions separately.

## Source and Tests

- [ChatWorkspace](../components/chat/ChatWorkspace.tsx) / [tests](../components/chat/ChatWorkspace.test.tsx).
- [useSessionEvents](../hooks/useSessionEvents.ts) / [tests](../hooks/useSessionEvents.test.tsx).
- [session-store](../state/session-store.ts) / [tests](../state/session-store.test.ts).
- [Shared protocol](../../shared/protocol.ts), [message projection](../../shared/session-projection.ts) / [tests](../../shared/session-projection.test.ts).
