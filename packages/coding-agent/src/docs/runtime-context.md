# Runtime Context

Managed sessions describe their current permission policy in host-generated runtime context instead of changing the system prompt. The first model request records a complete snapshot; later runs record another only when the rendered context changes. Each new snapshot explicitly supersedes earlier snapshots. Permission checks and sandbox enforcement remain independent of this text.

## Usage

No extra configuration is required. Create a managed session and use its existing permission API while idle:

```typescript
import { createAgentSession, SessionManager } from "@loop/coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  permissionPreset: "read-only",
});
try {
  await session.setPermissionPreset("workspace-write");
  // The next prompt uses workspace-write context and the same system prompt.
} finally {
  session.dispose();
}
```

## Request assembly

The coding-agent layer renders permission guidance before each run. Its injected stream function projects retained snapshots into model-request messages after the associated user message. The snapshots use the user role and identify themselves as host-provided context. They are separate messages, not edits to user text or attachments. Agent continues to own only ordinary conversation history and the sequential tool loop.

For example, two runs under read-only followed by a workspace-write run produce this request order:

```text
stable system prompt
user task 1
runtime context: read-only
assistant/tool history 1
user task 2
assistant/tool history 2
user task 3
runtime context: workspace-write
assistant/tool history 3
```

An unchanged policy adds no new snapshot. Tool continuations reuse the same snapshot at the same position; permission changes append after earlier history. Earlier snapshots remain intact to preserve the request prefix and the policy described during previous work. This improves cache stability but does not guarantee a provider cache hit. Context text still consumes tokens, and distinct changes accumulate until history is discarded; Loop has no compaction.

## Storage and lifecycle

`RuntimeContextSnapshot` is exported with `userTurn`, `content` and `timestamp`. `userTurn` is the zero-based ordinal among actual user messages, not an index among all messages. This anchor remains valid when request normalization removes failed assistant messages or adapts history for another model. Snapshots are stored in the session header's optional `runtimeContexts` field, separate from conversation messages.

`SessionManager.getRuntimeContexts()` returns a cloned snapshot, including pending save state. `commit(messages, runTimings?, runtimeContexts?)` accepts complete snapshots; omitted runtime context preserves the existing value. Invalid ordering, missing user turns, empty text or invalid timestamps reject. Hosts that replace or truncate history must supply matching context metadata.

Only a run that reaches the model dispatch records a new snapshot. Preflight failures and cancellation before dispatch record none. Model failures and cancellation after dispatch retain the context supplied to that attempt. Context and conversation history are committed together; a failed save retains both for `flush()` without replaying tools or calling the model again. Process termination before that commit has the same recovery limits as ordinary history.

Restoring a session reuses the exact stored snapshot text, timestamp and position. Sessions without snapshots add current context at the next request. Permission switches that occur before the next request collapse to the final effective selection. Sessions without a managed policy add no context; if restored history contains an earlier policy snapshot, one clearing snapshot marks it obsolete.

## Presentation and limits

Runtime snapshots do not enter `session.state.messages`, user message events, title generation, conversation counts, or message timing indices. CLI and Web continue to display actual user and assistant messages. A custom `ModelRuntime.streamSimple` receives the projected model request, including runtime context; its message count can therefore differ from the session's conversation count. Title requests use their own context and do not receive permission snapshots.

This is an internal permission-context path, not a plugin registration API, approval service or risk classifier. The user-role envelope does not grant authority; tool policy remains authoritative. Custom system-prompt replacement still replaces the base instructions only, as described in [context files](context-files.md).

## Source

[Projection and validation](../core/runtime-context.ts), [permission narration](../core/permissions/permission-context.ts), [model dispatch](../core/model-runtime.ts), [session lifecycle](../core/agent-session.ts), [storage](../core/session-manager.ts), and [projection tests](../core/runtime-context.test.ts).
