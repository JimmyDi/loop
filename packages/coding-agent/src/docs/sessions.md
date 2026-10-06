# Sessions and Recovery

A coding session keeps conversation history across prompts. Each prompt creates a fresh Agent from committed messages, then stores the complete resulting history after the run finishes or fails.

## Create or restore

```bash
pnpm run coding-agent
pnpm run coding-agent --continue
pnpm run coding-agent --session /path/to/session.jsonl
pnpm run coding-agent --no-session
```

A new persistent session immediately creates its metadata file. Continuing uses the most recently updated session in the current workspace; if none exists, it creates one. Opening uses an exact file path, not a fuzzy ID search.

SDK consumers supply one of these managers to `createAgentSession({ sessionManager })`:

| API | Behavior |
| --- | --- |
| `SessionManager.inMemory(cwd?)` | Empty history with no file. |
| `SessionManager.create(cwd, sessionDir?)` | Empty persistent session. |
| `SessionManager.draft(cwd, sessionDir?)` | Draft with a stable ID and target path; no file until a commit contains a user message. |
| `SessionManager.open(path)` | Restore and validate a Loop JSONL file. |
| `SessionManager.continueRecent(cwd, sessionDir?)` | Resume most recent or create. |
| `SessionManager.list(cwd, sessionDir?)` | List supported session metadata for the canonical workspace, newest first; unsupported formats are excluded without changing files. |
| `manager.markRead(messageCount)` | Persist unread: false only when the viewed message count matches saved history; return false for stale counts. |
| manager.setPinned(pinned) | Persist optional header pinnedAt, preserving history and activity; return its timestamp or undefined after unpinning. |

List summaries include messageCount and userMessageCount so hosts can distinguish drafts from conversations. Draft metadata edits remain in memory; the first commit containing any user message, including attachments, creates the history file with the same ID and accumulated metadata. A failed first save retains pending history for flush. Web opts into drafts; the default CLI/SDK create method still persists empty sessions immediately. Uncommitted drafts do not survive process exit.

Malformed session files reject rather than being silently repaired or skipped. A restored session requires its stored cwd to exist. See [session format](session-format.md) for the storage contract.

## Completed history

Read `session.state.messages` after finalization for user, assistant, and matching tool-result messages. It returns the full history, not just this prompt's additions. Streaming drafts remain separate, and neither system prompt nor tool declarations accumulate as conversation entries.

The manager commits one full snapshot at the end of each prompt, including model errors and cancellation. It writes a temporary sibling and renames it over the session file. A `message_end` event does not mean that snapshot has been persisted.

New completed output also sets header unread to true; runs without output and repeated saves preserve it. Read session.state.unread or manager.unread for the current flag, and use manager.markRead(messageCount) after viewing completed output. It preserves timestamps and rejects pending saves; hosts can publish their own UI notifications after success. See [session format](session-format.md) for stale-receipt handling.

[Runtime context](runtime-context.md) is saved as separate header metadata in the same commit. It is projected into model requests while leaving conversation messages, title inputs, counts and history positions unchanged. Permission switches do not rewrite the system prompt or earlier runtime snapshots.

[Session titles](session-titles.md) are independent header metadata and may finish after a prompt. History/model/title writes serialize within one manager. Call `waitForTitle()` before disposal to retain generated titles, or `abort()` to cancel and drain both the main run and title work. Runtime replacement cancels and drains old title work before opening another writable session.

[Approval requests](approvals.md) are session-owned, in-memory interaction state. Pending requests block new prompts, permission/model/title changes and session replacement until settled or cancelled. Abort cancels them, and run finalization drains outstanding requests before saving. Idle disposal cancels them before clearing observers. No approval request, decision or handler is restored from session storage; rebind the handler when replacing a session.

## Prompt duration

Each accepted prompt records wall time in optional state.promptTimings, using PromptTiming with the zero-based userMessageIndex, startedAt and optional finishedAt in Unix milliseconds. Measurement begins at acceptance and ends after model/tool generation, including failures, cancellation and approval waits. Saving, retries and background title generation are excluded. Preflight failures without a new user message leave no stored timing. This metadata never enters model requests.

The prompt_timing event publishes start and finish snapshots. SessionManager.getPromptTimings() returns cloned completed timings, including pending state after a save failure. Reopening or flushing preserves the original duration. Earlier sessions without timings remain valid; no elapsed time is inferred from message timestamps.

## Save failure

If storage fails, the old file remains intact and the attempted snapshot stays in memory. `state.hasPendingSave` becomes true; new prompts, model changes, session replacement, and disposal reject until saving succeeds.

Keep the live session, repair the directory or storage issue, and call `await session.flush()`. This writes the retained snapshot without running tools or requesting the model again. If execution and saving both fail, `prompt()` rejects with an `AggregateError` containing both failures.

The CLI accepts `/flush` and refuses ordinary exit while a save is pending. Print-mode recovery also waits for `/flush`. An SDK host is responsible for retaining its session and offering a recovery path instead of unconditionally discarding it in cleanup.

## Replace the active session

`AgentSessionRuntime` owns one current session. Create it with `createAgentSessionRuntime(factory, { cwd, sessionManager, model? })`; the factory returns `Promise<{ session: AgentSession }>` and normally delegates to `createAgentSession` with host settings and tools.

| Member | Behavior |
| --- | --- |
| `session`, `cwd` | Current session and its canonical workspace. |
| `newSession()` | Empty history preserving selected model, cwd, and persistent/in-memory mode. |
| `switchSession(path)` | Restore history/model/cwd from another session file. |
| `setRebindSession(callback?)` | Attach consumers to the new session after replacement. |
| `dispose()` | Await cancellation and dispose the current session. Rejects when replacement is active or a save remains pending. |

Both replacements return `{ cancelled: false }` on success. Busy operations reject; there is no deferred switch queue. A preparation failure preserves the previous session. Rebind callbacks run after the replacement is installed; a rebind failure does not roll back to the previous session.

Subscriptions remain attached to their session instance. Remove the previous subscription and attach a new one inside the rebind callback. Runtime factories recreate tools/resources for the target cwd.

## Limits

Prompts are passed to the model runtime without a Loop-specific estimated-context rejection. Full text and history consume memory and model context; the provider can reject excessive requests through the normal prompt error flow. Loop does not truncate user content automatically.

There is no branching, fork/import API, compaction, background checkpointing, crash replay, or cross-process write coordination. A forced exit can lose the current run. Atomic rename does not promise power-loss durability or exactly-once tool effects. Keep conversation files private; tool results may contain source text, local paths, or sensitive output.

## Source

[session-manager.ts](../core/session-manager.ts), [agent-session.ts](../core/agent-session.ts), [agent-session-runtime.ts](../core/agent-session-runtime.ts), [session tests](../core/session-manager.test.ts), and [save recovery](../modes/save-recovery.ts).
