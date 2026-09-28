# SSE Events

The server pushes session snapshots and coding-agent events to the browser using Server-Sent Events. HTTP commands flow downward, while SSE reports execution state without importing frontend code into lower layers.

## Connections and Frames

Connect to `GET /api/sessions/:id/events`. SSE data is a JSON Frame and its id is `streamId:seq`. There is no custom SSE event field; browsers consume messages through onmessage.

| Frame type | Content |
| --- | --- |
| session.snapshot | Complete snapshot on first connection or when replay is unavailable |
| session.state | Complete snapshot after command-state changes and run finalization |
| run.accepted | Accepted requestId and runId |
| loop.event | SDK SessionEvent, runId, and optional messageIndex |

Every frame includes sessionId, streamId, and seq. streamId belongs to one SessionEvents instance. seq increments on publish; a connection snapshot uses the current sequence without incrementing it.

Native SDK events are message_start, message_update, message_end, tool_execution_start, tool_execution_end, and agent_settled. Web wraps them in loop.event without renaming them. message_update still carries the original AI event. See [coding-agent events](../../../coding-agent/docs/events.md) for the full contract.

## Replay and Snapshots

Clients can supply a cursor through Last-Event-ID or the cursor query parameter; the header takes precedence. If the cursor belongs to the same stream, precedes the current sequence, and the buffer still contains contiguous subsequent frames, replay them in order. Otherwise send a full snapshot, then subscribe to new events.

The default cache holds at most 256 frames and 4 MiB of serialized data, evicting old frames when either limit is exceeded. There is no await between snapshot/replay and live subscription, avoiding lost events at that boundary. State projection replaces drafts and completed messages by messageIndex and merges tool results by call ID.

## Connection Lifecycle

SSE comment heartbeats are sent every 15 seconds without a business sequence number. Each connection has a 1 MiB output-buffer target. A client that stops consuming data is disconnected; the frontend reconnects using replay or a snapshot.

Aborting a request or cancelling its stream removes only that connection's listeners and timer, without cancelling AgentSession. Disposing an instance closes its connections. Server restart creates a new streamId. Replay is not a durable event log, does not recover unsaved execution, and does not re-execute commands.

## List Change Notifications

Connect once per page to `GET /api/workspaces/events` independently of the selected session. SSE data is a JSON ListFrame with streamId and seq, using the same id format and onmessage handling as session events.

| Frame type | Client action |
| --- | --- |
| lists.reset | Refresh projects, cached session lists and archived chats |
| sessions.changed | Refresh the session list for workspaceId and archived chats |
| projects.changed | Refresh projects, the session list for workspaceId and archived chats |

Incremental notifications contain only workspaceId and cursor metadata, without messages or snapshots. They are published after project registration/rename/removal and archive/restore/deletion operations, on accepted runs, first user messages, command-state changes, run settlement and asynchronous title updates. All loaded controllers are observed, even without a per-session browser connection. Token deltas and tool events do not trigger list refreshes. Operations that partially complete before failing also notify clients so completed changes remain visible.

Each new connection always receives lists.reset at the current sequence, even if Last-Event-ID is supplied. The list stream retains no replay buffer; clients reload lists to recover missed changes. It shares the transport's 15-second comment heartbeat, backpressure and disconnect cleanup. Heartbeats do not read history or refresh lists. Controller disposal removes its watcher; registry shutdown closes all list connections.

Notifications cover changes made through this Web process. They do not watch external CLI writes or filesystem edits; reload the page to pick up those changes. This stream synchronizes list queries, not another page's selected session or unsent drafts.

## Source and Tests

- [SessionEvents](../session-events.ts) / [replay tests](../session-events.test.ts).
- [ListEvents](../list-events.ts) / [notification tests](../list-events.test.ts).
- [SSE response](../http/sse.ts) / [cursor and cancellation tests](../http/sse.test.ts).
- [SessionController](../session-controller.ts) / [tests](../session-controller.test.ts).
- [Shared protocol](../../shared/protocol.ts), [state projection](../../shared/session-projection.ts) / [tests](../../shared/session-projection.test.ts).
- See [frontend streaming state](../../frontend/docs/events.md) for the consumer.
