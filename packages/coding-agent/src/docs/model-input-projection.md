# Model Input Projection

Model requests use a separate projection of complete session history. Normalization adapts messages, expands selected Skills and replays legacy context before budget measurement. Sources retain original positions. With a saved compaction checkpoint, projection replaces the older model input prefix with a summary; originals remain unchanged. Without a checkpoint, projection does not shorten history.

## Minimal usage

Given an existing session, inspect the latest dispatched main request's origins through the public SDK:

```typescript
import type { AgentSession, ModelInputProjection } from "@loop/coding-agent";

const inspectInput = (session: AgentSession): ModelInputProjection | undefined =>
  session.modelInputProjection;
```

The getter clones metadata only, without collecting system prompts, schemas or another copy of message bodies. It does not make model calls. Complete originals remain in `session.state.messages`; runtime snapshots remain in `session.sessionManager.getRuntimeContexts()`.

## Source-map reference

`ModelInputProjection` has `historyMessageCount` and `sources`. `sources[i]` describes message `i` in the final main `Context.messages` sent to `ModelRuntime.streamSimple`, after normalization and runtime injection. All indexes are zero-based.

| Source type | Fields | Meaning |
| --- | --- | --- |
| `history` | `messageIndex` | Original entry in complete session history. |
| `compaction` | `checkpointId`, `messageIndex`, `summarizedBefore` | Summary of the original prefix before the retained boundary. |
| `runtime-context` | `snapshotIndex`, `userTurn`, `messageIndex`, `skills` | Stored runtime snapshot, actual user-turn ordinal, original anchoring user index, and selected Skill IDs/revisions. |
| `tool-repair` | `messageIndex`, `toolCallId` | Request-only missing-result repair, originating from this assistant entry and tool call. |

`historyMessageCount` includes the accepted user input and all completed entries at dispatch, including failed assistant responses. It excludes streaming drafts and the response to that request. A runtime entry's `skills` contains only IDs and revisions; actual instructions remain in the referenced snapshot. Automatically loaded Skills arrive as ordinary `load_skill` results and have `history` origins. MCP calls through Codemode likewise retain ordinary assistant/result origins; nested calls do not create separate model messages.

For a legacy example, complete history contains user 0, failed assistant 1 and user 2. Two runtime snapshots without `placement` are anchored at user turns 0 and 1. The request has four messages, with sources:

```text
history messageIndex=0
runtime-context snapshotIndex=0 userTurn=0 messageIndex=0
history messageIndex=2
runtime-context snapshotIndex=1 userTurn=1 messageIndex=2
```

The failed assistant remains saved at index 1. Repeated text and identical timestamps do not affect origin tracking. Model switches may change thinking/image blocks while preserving their message origins. Tool repairs are identified separately and never appended to stored history by projection.

## Lifecycle and errors

Every main request, including sequential tool continuations, builds a fresh projection before [budget checking](context-budget.md). Agent supplies original indexes separately through the stream boundary's optional fourth `ModelInputMetadata` argument; coding-agent combines these with runtime origins. Temporary origin markers are removed before dispatch, and the metadata is not forwarded to the provider. Original history, snapshots and tool schemas are isolated from mutations to request messages.

`modelInputProjection` is updated once a request passes budget and cancellation checks and reaches dispatch. It remains available after completion, model failure or cancellation after dispatch. Accepted new prompts and successful model switches clear it. A preflight or budget rejection does not produce a dispatched projection. If a continuation is rejected, the earlier dispatched projection remains available, while the latest budget describes the rejected attempt.

The map is transient and is not added to session JSONL. Reopening a session returns no map until the next main request regenerates it from saved history and runtime snapshots. History and snapshot persistence continue through the existing atomic commit and pending-save recovery. Invalid origin lengths/indexes or invalid snapshot anchors reject before model dispatch.

## Limits and related features

Origins are message-level, not character/block offsets or provider wire-payload indexes. System instructions and declarations remain separate fields. Manual and automatic compaction checkpoints are described in [compaction](compaction.md); model-driven historical retrieval is not implemented. Source maps do not recover originals by themselves. Read originals from complete session history. Hosts replacing history must keep matching [runtime metadata](runtime-context.md).

New selected Skill snapshots use `placement: "user"` and prepend instructions to their anchored model user message. Optional `skillExpansions` records message indexes, snapshot indexes and Skill IDs/revisions without adding source rows. Legacy snapshots remain separate user messages. System section checkpoints are persisted separately from the transient map.

See [Agent model boundary](../../../agent/src/docs/agent-loop.md#model-boundary), [runtime snapshots](runtime-context.md), [Skills](skills.md), [session storage](session-format.md) and [SDK](sdk.md).

## Source and tests

[Projection](../core/model-input-projection.ts), [projection tests](../core/model-input-projection.test.ts), [request assembly](../core/model-request.ts), [dispatch](../core/model-runtime.ts), [session integration](../core/agent-session.test.ts) and [normalization tests](../../../agent/src/normalize-model-input.test.ts).
