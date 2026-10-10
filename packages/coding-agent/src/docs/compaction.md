# Context Compaction

Context compaction replaces older model input with an LLM-generated summary while retaining every original message. It runs automatically under input pressure or through the manual command. Both use the configured runtime with no tools and a separate summarization prompt.

## Minimal usage

Automatic compaction needs no configuration. Web shows the existing conversation compaction status while the prompt remains running, with Stop available. It resumes the same prompt after saving; refreshing or reconnecting preserves live activity timing. Interactive CLI shows compaction status and supports `/abort`.

For manual compaction in Web, type `/` in the composer and choose **Compact** when an older complete turn can be summarized, or submit `/compact`; the composer Stop button cancels. The command menu shows the latest request’s estimated context usage when available. Interactive CLI uses `/compact` and `/abort`. SDK hosts call `session.compact()`.

```typescript
import { createAgentSession, NothingToCompactError, SessionManager } from "@loop/coding-agent";

const { session } = await createAgentSession({ sessionManager: SessionManager.inMemory() });
try {
  await session.prompt("Explain this project.");
  await session.prompt("Which part should be tested first?");
  try {
    await session.compact();
  } catch (error) {
    if (!(error instanceof NothingToCompactError)) throw error;
    // Short conversations need no summary; keep using the existing context.
  }
  await session.prompt("Continue with that test plan.");
} finally {
  await session.abort();
  session.dispose();
}
```

## Automatic policy

Before every main model request, including the next request after a complete sequential tool batch, core assembles the full projected request and checks estimated input against ninety percent of its input limit:

```text
inputLimit = max(0, contextWindow - reservedOutputTokens - safetyTokens)
automaticThreshold = inputLimit * 0.9
```

The [output reserve](context-budget.md) includes effective native reasoning adjustments. This threshold is a percentage of input capacity, not of the entire model window. It counts system instructions, tool declarations, saved summaries, selected Skills and tool results. Unsent drafts are excluded.

The first pass uses the normal recent-turn retention budget below. After generating a summary, core reassembles and measures the complete candidate request. It accepts only a strict reduction, then atomically saves the checkpoint together with the live original history, prepared Skill snapshots and system checkpoints before dispatching the main request. Original message indexes and completed tool results stay unchanged.

If that request still exceeds the hard input limit, one emergency pass lowers recent retention to zero while always preserving the entire newest user turn. When the normal planner has no older prefix to select but input is already over the hard limit, it can likewise try this emergency boundary. There are at most two generation attempts per preflight. Pressure above ninety percent alone does not cause a second pass when the candidate fits the hard limit.

If there is no legal boundary or input still exceeds the hard limit, the main request rejects with `ContextBudgetExceededError`. Summary failure, timeout or a candidate that does not reduce input leaves that candidate unsaved; execution can continue only if the current request fits. Save failures always stop execution and retain pending state. Cancellation always stops the prompt. Completed tools are never repeated by compaction.

Within one prompt run, after two consecutive pressured preflights, further compaction is suppressed until a below-threshold request resets the counter. A suppressed request can proceed only if it fits the hard limit. This bounds repeated summary work when a large newest turn or instructions dominate input. A new prompt starts a fresh counter.

## Boundaries and generation

Compaction requires two uncompressed user turns. It preserves the newest complete turn and as many preceding recent turns as fit a retention estimate: twenty percent of the context window, clamped to 256–20000 tokens. Count tokens backward over projected messages, including expanded selected Skill instructions and legacy runtime snapshots. Source indexes group these messages into original user turns; injected snapshots do not create extra turns. Already summarized history is excluded. These are local estimates, not exact provider counts.

If all uncompressed turns fit the retention budget, including exactly at the limit, or fewer than two turns exist, `compact()` rejects with `NothingToCompactError` ("Nothing to compact"). It skips authentication, summary generation and storage writes. The session settles with idle outcome and no saved error; the SDK still rejects so hosts can distinguish no work. `SessionState.compactionAvailable` reports whether the same local planner used by execution can select an older complete turn. Busy state, pending saves and pending approvals remain separate execution guards. It refreshes on reopening, prompt settlement, compaction, model changes and save recovery, without provider calls or storage writes. Web disables short contexts before the first click and displays one localized neutral notice for five seconds and disables repeated attempts until history, checkpoint or the selected model changes. Otherwise, summarize only the prefix before the retained turns. Boundaries always start at an original user message, preserving assistant/tool groups; oversized single turns are not split and the newest turn is always retained. System instructions and tool schemas are not part of this recent-message retention target; the complete model request has a separate budget check.

Summary input includes selected Skill expansions and legacy context, text and tool arguments/results. Image bytes and private thinking are omitted with markers; failed or aborted assistant replies are excluded. The model summarizes goals, constraints, decisions, progress, next steps and files. Prior summaries are supplied for incremental updates; retained turns are excluded. The summary request passes its own [budget check](context-budget.md), reserving its own caller output cap rather than the model maximum and verifying the provider payload limit before sending.

No tools are registered. Output is capped at the smaller of 4096 and the model maximum; native reasoning adapters may adjust limits. Empty, failed, truncated, cancelled or tool-calling responses reject. Native summary usage is saved separately from assistant history. Summaries may lose detail; originals remain authoritative.

## Persistence and API

`getCompactions()` returns cloned `CompactionCheckpoint` records: `id`, `firstKeptMessageIndex`, `historyMessageCount`, `summary`, `timestamp`, provider/model and native `usage`. Indexes reference unchanged complete history. Boundaries must advance and reference user messages; invalid records reject on restore.

Successful checkpoints are atomically saved in the existing version-2 JSONL header. The next main request uses current system instructions, a `<summary>` user message and history from the boundary onward. Original UI history remains complete. Older Skill expansions remain saved but contribute through the summary. Source mapping identifies the checkpoint and covered prefix.

`state.compaction` exposes only the latest checkpoint ID, boundary, captured history count and time. Web clears unchanged command text on completion and disables another compaction until two uncompressed turns exist. After successful compaction or reopening, core locally recomputes the retained-context budget so the command’s estimated percentage remains available before the next prompt. The next main dispatch rebuilds model input and its source map from the latest saved checkpoint and retained original history.

## Cancellation, errors and recovery

Manual compaction shares the ordinary session lock and cannot overlap prompts, configuration or approvals. Automatic compaction holds the existing prompt lock, with no separate command run or duplicate user submission. `abort()` interrupts generation and authentication waits. Generation has a two-minute timeout. Failed generation leaves prior checkpoints unchanged. Accepted prompts and completed tool results still follow ordinary history saving. Cancellation after persistence starts does not roll back a completed write; finalization waits for that save before releasing the session lock. An earlier successful pass is retained if a later pass fails.

Failed saves retain pending history and checkpoint, preserve the previous on-disk file and block new work until `flush()`. Flushing never regenerates a summary or repeats tools. Restart restores persisted checkpoints; pending unsaved state cannot survive termination.

Web exposes `POST /api/sessions/:id/compact` under existing local request and project guards. It holds the command lock and returns the settled snapshot; SSE publishes busy and settled state. A short context returns HTTP 400 with code `nothing_to_compact`, preserves drafts and leaves prior history/checkpoints unchanged. The existing abort endpoint cancels it. Models cannot invoke this host operation.

## Limitations

No provider-overflow retry, branches, model-driven historical retrieval or full-history restoration control. Automatic thresholds use local estimates rather than provider-calibrated token counts. Oversized summary input rejects without truncation; select a larger model. A summary can exceed the size of a short original prefix, and an oversized retained turn can still exceed the next request budget. Automatic compaction rejects nonreducing candidates; manual compaction retains its existing behavior. Images are not visually summarized. There is no per-message ID migration or cross-process write coordination.

## Source and tests

[Planning](../core/context/compaction-plan.ts), [generation](../core/context/generate-summary.ts), [validation](../core/context/compaction-checkpoint.ts), [manual workflow](../core/context/compact-session.ts), [manual tests](../core/context/compact-session.test.ts), [automatic policy](../core/context/automatic-compaction.ts), [automatic tests](../core/context/automatic-compaction.test.ts), [projection](model-input-projection.md), [storage](session-format.md).
