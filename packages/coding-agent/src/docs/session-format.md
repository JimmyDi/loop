# Session File Format

Loop persists each session in three files: version-3 storage metadata, JSONL messages and a rebuildable round index. The public SessionHeader retains its version-2 schema; the storage envelope has its own version. Version-2 single-file sessions remain readable and migrate on explicit open.

## Location

```text
<agentDir>/sessions/<workspace-hash>/<session-id>/meta.json
<agentDir>/sessions/<workspace-hash>/<session-id>/messages.jsonl
<agentDir>/sessions/<workspace-hash>/<session-id>/index.json
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
| promptTimings | Optional completed PromptTiming[] ordered by userMessageIndex and attempt ranges, with startedAt and finishedAt in Unix milliseconds. New records add a unique id, inclusive messageStartIndex, exclusive messageEndIndex and optional stopped flag. Resumed attempts may share the same user index. Legacy records remain valid; duplicate IDs, overlapping ranges and invalid indices/timestamps reject. See [prompt duration](sessions.md#prompt-duration). |
| runtimeContexts | Optional RuntimeContextSnapshot[]: zero-based userTurn ordinal, rendered content, timestamp in Unix milliseconds and optional skills with loaded identities, source paths, instruction texts, revisions and optional descriptions. See [runtime context](runtime-context.md). |
| systemPromptCheckpoints | Optional initial system sections and subsequent changed-section patches. |
| compactions | Optional complete summaries, original-history boundaries, model identity and summary usage. See [compaction](compaction.md). |

Omitted effort uses Default. Unknown effort values reject; supported levels depend on model metadata. The header stores no API key or endpoint. Reconfigure those through [model runtime](models.md) when restoring a session.

The header accessor and session list derive a fallback from the first eligible user message when stored title metadata is absent; reading does not rewrite the file or call a model. Stored titles live only in the header; auxiliary prompts and responses are not conversation records. Title-only writes preserve activity timestamps and serialize with history/model writes. Malformed title metadata rejects on load.

Obsolete execution-section timing metadata in existing version-2 headers is ignored on load and omitted from later saves. Opening a legacy session validates it and publishes a new three-file directory using a staging directory and rename; its original JSONL remains unchanged as a backup. Listing sessions does not migrate them. A valid published directory takes precedence over its legacy backup; an invalid published directory reports an error instead of falling back to stale history. Do not open migrated sessions with older Loop versions, which cannot see newer history in the directory.

## Messages

Each line of messages.jsonl is a `Message` directly, not an entry wrapper with `id` or `parentId`. Roles are `user`, `assistant`, and `toolResult`. Message timestamps are numeric milliseconds, unlike the header's ISO strings.

Assistant messages retain content blocks, API/provider/model identity, usage, stop reason, and any model error. Tool results retain `toolCallId`, `toolName`, `content`, and `isError`. New MCP results additionally preserve the host-generated `details.loopDisplayName` (server name and original tool name) for historical display, including after disabling or removing the server. This optional presentation metadata does not change call/result pairing or the model tool identifier. Matching results must follow completed assistant tool calls before a new conversation turn. The loader rejects unsupported message shapes or incomplete pairing; error/aborted assistant calls are excluded from pairing validation because request normalization filters those assistants on replay.

User content may contain text and base64 image blocks. Images persist inside the same session JSONL; there is no separate attachment file.

There are no stored streaming deltas, drafts, tool functions, or model-change entry records. Optional `systemPromptCheckpoints` retain initial rendered sections and subsequent changes; optional `compactions` retain summaries, original-history boundaries, model identity and native summary usage. New explicit Skill snapshots use `placement: "user"`; absent placement preserves legacy replay. Changing the model updates header metadata. Ordinary saves append new messages without moving existing records. Metadata is published atomically after message bytes are written. If a caller replaces an earlier message or truncates history, storage appends a new complete generation and switches the committed range; older bytes remain unreachable in the same file. This preserves the complete-history commit API without exposing partial replacements.

`commit(messages, runtimeContexts?, promptTimings?, context?)` accepts optional complete `context.compactions` and `context.systemPromptCheckpoints` arrays; omitted arrays preserve existing metadata. `getCompactions()` and `getSystemPromptCheckpoints()` return cloned committed or pending state. Boundaries reference unchanged message indexes; checkpoint validation rejects invalid anchors before write and on restore.

## Read and write

SessionManager.setPinned(pinned: boolean) serializes pin changes with history, title, model and read writes. It returns the saved ISO timestamp when pinned, or undefined when unpinned. Repeating true preserves the existing pin timestamp; false removes pinnedAt. Pin writes preserve conversation messages and updatedAt, never enter model context, and do not create an empty draft file. A commit prepared during a pin write inherits the accepted metadata. If history has a pending save, pin updates preserve that pending snapshot for flush. A failed pin write leaves the accepted header unchanged and can be retried. getHeader() and SessionManager.list() expose the saved pinnedAt; hosts can publish their own list notifications after success. Use a single manager per writable session; independent processes do not coordinate writes.

Unread is stored only in the header. commit() sets unread when newly appended history contains assistant or tool output. Re-saving the same history or a run without output preserves the flag. SessionManager.markRead(messageCount) serializes with history and metadata writes and clears unread only when that count matches the nonempty saved history. The count is supplied by the reader and is not an extra stored field. It returns true for an accepted or duplicate receipt, false for a mismatched or empty history, and rejects invalid counts, pending saves or write failures. Read metadata changes preserve messages and activity timestamps. SessionManager.unread and session.state.unread include the pending flag after a save failure; getHeader() exposes committed metadata. No extra storage file is used.

Use `SessionManager.open(path)` and its snapshot accessors rather than editing live files. `commit(messages, runtimeContexts?, promptTimings?, context?)` expects complete history and preserves existing metadata when optional arguments are omitted. `getRuntimeContexts()` returns a cloned snapshot, including pending state after a save failure. Runtime snapshots require strictly increasing user-turn ordinals referencing actual user messages, nonempty content, and nonnegative safe integer timestamps. New snapshots record explicitly selected Skills; current permission guidance belongs to the system prompt. On failure, `flush()` retries the same pending snapshot; see [sessions and recovery](sessions.md).

All storage constructors expose a version-2 SessionHeader with a read-only permission preset and persist a version-3 storage envelope. The managed factory applies explicit selections or new-session settings before enabling tools. Opening a file requires valid permission metadata and never converts unsupported formats. Session discovery skips files with an unsupported format or version without modifying them, so they cannot block supported sessions. Invalid JSON, invalid current-format metadata and storage read errors still report failures. Share only synthetic fixtures: real session cwd and conversation/tool content can disclose local information.

## Source

[Storage types](../core/types/storage.ts), [session-manager.ts](../core/session-manager.ts), [message validation](../core/messages.ts), and [atomic-write.ts](../utils/atomic-write.ts).

## Commit and index recovery

meta.json contains format, version: 3, header, a SHA-256 generation of the committed message bytes, start, bytes and messageCount. Only that committed byte range is visible. A crash before metadata publication leaves an ignored tail; the next save truncates the uncommitted tail before appending. Metadata-only changes do not rewrite message bytes. The directory uses private permissions and files are created with mode 0600 where supported. A single SessionManager owns writes; independent processes must not write the same session concurrently.

index.json records the generation and each user round's messageIndex and UTF-8 byteOffset relative to the committed range. Missing, malformed or stale indexes are rebuilt from committed messages on a page read. Index publication failure does not roll back an already committed save. Full session open validates the message checksum and existing message/metadata contracts. Archiving and restoring update only archive membership, leaving all three files and any legacy backup in place. History saves preserve archive membership. Deletion stages the entire directory and any legacy backup together with traces; failure before the archive membership commit restores the staged files. Successful deletion removes all staged content so a legacy backup cannot reappear as a session.

## History pages

SessionManager.readHistory(before?, revision?) returns messages, start, end, total and revision. The default page contains the latest three user rounds; before is an exclusive global message index at a user-round boundary, and revision optionally rejects changed message generations. A round includes the user message and all assistant/toolResult records up to the next user. Requests read only the indexed byte range. In-memory or pending sessions page their current messages instead; the core/model session still holds its complete conversation for execution. Opening a session and current list discovery still validate complete histories, so this API is not a lazy model-context loader.

Legacy migration retains a backup and replacement generations retain old bytes, increasing disk use. There is no automatic backup removal or generation compaction. getSessionFile()/sessionFile now identify meta.json, while getSessionDir() continues to identify the project session collection. Consumers that parse a session path directly must use SessionManager instead.
