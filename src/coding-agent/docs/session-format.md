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
| `version` | Readers accept 1 and 2. Managed permission metadata uses 2; older binaries reject it. |
| `id` | Session UUID string. |
| `cwd` | Absolute canonical working directory. It must still exist when loading. |
| `createdAt`, `updatedAt` | ISO timestamp strings. |
| `model` | Optional `{ provider: string, id: string, effort?: ModelEffort }`. |
| `title` | Optional `SessionTitle`: text, source, source message indices, and optional model identity. See [session titles](session-titles.md). |
| `runTimings` | Optional `SessionRunTiming[]`: zero-based `userMessageIndex` plus `startedAt` and `finishedAt` in Unix milliseconds for each recorded prompt. |
| permissionPreset | Required for version 2: read-only, workspace-write or danger-full-access. Invalid values reject. |
| runtimeContexts | Optional RuntimeContextSnapshot[]: zero-based userTurn ordinal, rendered content and timestamp in Unix milliseconds. See [runtime context](runtime-context.md). |

Older files without effort remain valid and use Default. Unknown effort values reject; supported levels depend on model metadata. The header stores no API key or endpoint. Reconfigure those through [model runtime](models.md) when restoring a session.

Older files without titles remain valid. The header accessor and session list derive a fallback from the first eligible user message when stored title metadata is absent; reading does not rewrite the file or call a model. Stored titles live only in the header; auxiliary prompts and responses are not conversation records. Title-only writes preserve activity timestamps and serialize with history/model writes. Malformed title metadata rejects on load.

Older files without run timings remain valid; missing durations are not inferred from message timestamps. Stored timings must reference distinct user-message positions and contain nonnegative safe integer timestamps with `finishedAt >= startedAt`. Invalid metadata rejects on load. Timings are header metadata, never model context. Only finished timings are saved; see [execution timing](sessions.md#execution-timing) for the lifecycle.

## Messages

Each subsequent line is a `Message` directly, not an entry wrapper with `id` or `parentId`. Roles are `user`, `assistant`, and `toolResult`. Message timestamps are numeric milliseconds, unlike the header's ISO strings.

Assistant messages retain content blocks, API/provider/model identity, usage, stop reason, and any model error. Tool results retain `toolCallId`, `toolName`, `content`, and `isError`. Matching results must follow completed assistant tool calls before a new conversation turn. The loader rejects unsupported message shapes or incomplete pairing; error/aborted assistant calls are excluded from pairing validation because request normalization filters those assistants on replay.

User content may contain text and base64 image blocks. Images persist inside the same session JSONL; there is no separate attachment file.

There are no stored streaming deltas, drafts, system prompt, tool functions, or model-change entry records. Changing the selected model updates header metadata. Storage is a rewritten full snapshot, not an append-only event journal.

## Read and write

Use `SessionManager.open(path)` and its snapshot accessors rather than editing live files. `commit(messages, runTimings?, runtimeContexts?)` expects complete history and preserves existing timings and runtime context when their arguments are omitted. `getRunTimings()` and `getRuntimeContexts()` return cloned snapshots, including pending state after a save failure. Runtime snapshots require strictly increasing user-turn ordinals referencing actual user messages, nonempty content, and nonnegative safe integer timestamps. Legacy files may omit them. On failure, `flush()` retries the same pending snapshot; see [sessions and recovery](sessions.md).

Opening version 1 does not rewrite it. The managed SDK factory upgrades it to version 2 when recording its [permission preset](permissions.md#persistence-and-migration). Bare storage constructors can still produce version 1 until a preset is saved. No automatic repair or interoperability with other session formats is provided. Share only synthetic fixtures: real session cwd and conversation/tool content can disclose local information.

## Source

[Storage types](../core/types/storage.ts), [session-manager.ts](../core/session-manager.ts), [message validation](../core/messages.ts), and [atomic-write.ts](../utils/atomic-write.ts).
