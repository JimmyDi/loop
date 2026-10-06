# Session File Format

Loop persists a linear JSONL snapshot: one metadata header followed by complete conversation messages. Loop defines its own session format and record versions.

## Location

```text
<agentDir>/sessions/<workspace-hash>/<session-id>.jsonl
```

The agent directory defaults to `~/.loop`. The workspace hash is the first 24 hexadecimal characters of SHA-256 over canonical cwd. The session ID is a UUID. Explicit storage directories are supported through the CLI and SessionManager.

## Header

The exported `SessionHeader` contains:

| Field | Value |
| --- | --- |
| `format` | Always `"loop-session"`. |
| `version` | Always 2. Other versions are rejected. |
| `id` | Session UUID string. |
| `cwd` | Absolute canonical working directory. It must still exist when loading. |
| `createdAt`, `updatedAt` | ISO timestamp strings. |
| `unread` | Boolean, false for new sessions. New completed output sets true; marking the latest output read sets false. Missing values read as false; nonboolean values reject. |
| pinnedAt | Optional canonical ISO UTC timestamp of the pin. Missing means unpinned; nonstring, invalid or noncanonical values reject. |
| `model` | Optional `{ provider: string, id: string, effort?: ModelEffort }`. |
| `title` | Optional `SessionTitle`: text, source, source message indices, and optional model identity. See [session titles](session-titles.md). |
| permissionPreset | Required: read-only, workspace-write or danger-full-access. Invalid values reject. |
| promptTimings | Optional completed PromptTiming[] with ordered userMessageIndex, startedAt and finishedAt in Unix milliseconds. Invalid indices or timestamps reject. See [prompt duration](sessions.md#prompt-duration). |
| runtimeContexts | Optional RuntimeContextSnapshot[]: zero-based userTurn ordinal, rendered content and timestamp in Unix milliseconds. See [runtime context](runtime-context.md). |

Omitted effort uses Default. Unknown effort values reject; supported levels depend on model metadata. The header stores no API key or endpoint. Reconfigure those through [model runtime](models.md) when restoring a session.

The header accessor and session list derive a fallback from the first eligible user message when stored title metadata is absent; reading does not rewrite the file or call a model. Stored titles live only in the header; auxiliary prompts and responses are not conversation records. Title-only writes preserve activity timestamps and serialize with history/model writes. Malformed title metadata rejects on load.

Obsolete execution-section timing metadata in existing version-2 headers is ignored on load and omitted from later saves. Opening a session does not rewrite its file.

## Messages

Each subsequent line is a `Message` directly, not an entry wrapper with `id` or `parentId`. Roles are `user`, `assistant`, and `toolResult`. Message timestamps are numeric milliseconds, unlike the header's ISO strings.

Assistant messages retain content blocks, API/provider/model identity, usage, stop reason, and any model error. Tool results retain `toolCallId`, `toolName`, `content`, and `isError`. New MCP results additionally preserve the host-generated `details.loopDisplayName` (server name and original tool name) for historical display, including after disabling or removing the server. This optional presentation metadata does not change call/result pairing or the model tool identifier. Matching results must follow completed assistant tool calls before a new conversation turn. The loader rejects unsupported message shapes or incomplete pairing; error/aborted assistant calls are excluded from pairing validation because request normalization filters those assistants on replay.

User content may contain text and base64 image blocks. Images persist inside the same session JSONL; there is no separate attachment file.

There are no stored streaming deltas, drafts, system prompt, tool functions, or model-change entry records. Changing the selected model updates header metadata. Storage is a rewritten full snapshot, not an append-only event journal.

## Read and write

SessionManager.setPinned(pinned: boolean) serializes pin changes with history, title, model and read writes. It returns the saved ISO timestamp when pinned, or undefined when unpinned. Repeating true preserves the existing pin timestamp; false removes pinnedAt. Pin writes preserve conversation messages and updatedAt, never enter model context, and do not create an empty draft file. A commit prepared during a pin write inherits the accepted metadata. If history has a pending save, pin updates preserve that pending snapshot for flush. A failed pin write leaves the accepted header unchanged and can be retried. getHeader() and SessionManager.list() expose the saved pinnedAt; hosts can publish their own list notifications after success. Use a single manager per writable session; independent processes do not coordinate writes.

Unread is stored only in the header. commit() sets unread when newly appended history contains assistant or tool output. Re-saving the same history or a run without output preserves the flag. SessionManager.markRead(messageCount) serializes with history and metadata writes and clears unread only when that count matches the nonempty saved history. The count is supplied by the reader and is not an extra stored field. It returns true for an accepted or duplicate receipt, false for a mismatched or empty history, and rejects invalid counts, pending saves or write failures. Read metadata changes preserve messages and activity timestamps. SessionManager.unread and session.state.unread include the pending flag after a save failure; getHeader() exposes committed metadata. No extra storage file is used.

Use `SessionManager.open(path)` and its snapshot accessors rather than editing live files. `commit(messages, runtimeContexts?, promptTimings?)` expects complete history and preserves existing runtime context and prompt timings when their arguments are omitted. `getRuntimeContexts()` returns a cloned snapshot, including pending state after a save failure. Runtime snapshots require strictly increasing user-turn ordinals referencing actual user messages, nonempty content, and nonnegative safe integer timestamps. Snapshots are optional for sessions without a managed policy. On failure, `flush()` retries the same pending snapshot; see [sessions and recovery](sessions.md).

All storage constructors produce version 2 with a read-only permission preset. The managed factory applies explicit selections or new-session settings before enabling tools. Opening a file requires valid permission metadata and never converts unsupported formats. Session discovery skips files with an unsupported format or version without modifying them, so they cannot block supported sessions. Invalid JSON, invalid current-format metadata and storage read errors still report failures. Share only synthetic fixtures: real session cwd and conversation/tool content can disclose local information.

## Source

[Storage types](../core/types/storage.ts), [session-manager.ts](../core/session-manager.ts), [message validation](../core/messages.ts), and [atomic-write.ts](../utils/atomic-write.ts).
