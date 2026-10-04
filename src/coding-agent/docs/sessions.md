# Sessions and Recovery

A coding session keeps conversation history across prompts. Each prompt creates a fresh Agent from committed messages, then stores the complete resulting history after the run finishes or fails.

## Create or restore

```bash
bun run coding-agent
bun run coding-agent --continue
bun run coding-agent --session /path/to/session.jsonl
bun run coding-agent --no-session
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
| `SessionManager.list(cwd, sessionDir?)` | List metadata for the canonical workspace, newest first. |

List summaries include messageCount and userMessageCount so hosts can distinguish drafts from conversations. Draft metadata edits remain in memory; the first commit containing any user message, including attachments, creates the history file with the same ID and accumulated metadata. A failed first save retains pending history for flush. Web opts into drafts; the default CLI/SDK create method still persists empty sessions immediately. Uncommitted drafts do not survive process exit.

Malformed session files reject rather than being silently repaired or skipped. A restored session requires its stored cwd to exist. See [session format](session-format.md) for the storage contract.

## Completed history

Read `session.state.messages` after finalization for user, assistant, and matching tool-result messages. It returns the full history, not just this prompt's additions. Streaming drafts remain separate, and neither system prompt nor tool declarations accumulate as conversation entries.

The manager commits one full snapshot at the end of each prompt, including model errors and cancellation. It writes a temporary sibling and renames it over the session file. A `message_end` event does not mean that snapshot has been persisted.

[Runtime context](runtime-context.md) is saved as separate header metadata in the same commit. It is projected into model requests while leaving conversation messages, title inputs, counts and timing indices unchanged. Permission switches do not rewrite the system prompt or earlier runtime snapshots.

[Session titles](session-titles.md) are independent header metadata and may finish after a prompt. History/model/title writes serialize within one manager. Call `waitForTitle()` before disposal to retain generated titles, or `abort()` to cancel and drain both the main run and title work. Runtime replacement cancels and drains old title work before opening another writable session.

## Execution timing

`session.state.runTimings` exposes per-prompt `SessionRunTiming` metadata, keyed by the zero-based position of the user message. `startedAt` records prompt acceptance before model preflight; `finishedAt` is added when model/tool execution ends, including failure or cancellation. Duration includes preflight and the complete model/tool loop, but excludes history saving, save retries and asynchronous title work. A rejected preflight that never appends a user message creates no historical timing.

The session emits [run_timing events](events.md) at execution start and finish. Completed timings are saved with history and restored when reopening the session. An in-progress timing has no `finishedAt`; old sessions can lack timing metadata entirely. `SessionManager.getRunTimings()` includes pending timings after a save failure, so flushing retains the original duration. Timings do not modify conversation messages or enter model context.

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

Subscriptions do not migrate by themselves. Remove the previous subscription and attach a new one inside the rebind callback. Runtime factories recreate tools/resources for the target cwd.

## Limits

Prompts are passed to the model runtime without a Loop-specific estimated-context rejection. Full text and history consume memory and model context; the provider can reject excessive requests through the normal prompt error flow. Loop does not truncate user content automatically.

There is no branching, fork/import API, compaction, background checkpointing, crash replay, or cross-process write coordination. A forced exit can lose the current run. Atomic rename does not promise power-loss durability or exactly-once tool effects. Keep conversation files private; tool results may contain source text, local paths, or sensitive output.

## Source

[session-manager.ts](../core/session-manager.ts), [agent-session.ts](../core/agent-session.ts), [agent-session-runtime.ts](../core/agent-session-runtime.ts), [session tests](../core/session-manager.test.ts), and [save recovery](../modes/save-recovery.ts).
