# Session File Format

Loop persists a linear JSONL snapshot: one metadata header followed by complete Pi AI messages. It uses its own format, not Pi's session tree or record versions.

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
| `version` | Currently `1`. Unsupported versions reject. |
| `id` | Session UUID string. |
| `cwd` | Absolute canonical working directory. It must still exist when loading. |
| `createdAt`, `updatedAt` | ISO timestamp strings. |
| `model` | Optional `{ provider: string, id: string }`. |

The header stores no API key or endpoint. Reconfigure those through [model runtime](models.md) when restoring a session.

## Messages

Each subsequent line is a Pi AI `Message` directly, not an entry wrapper with `id` or `parentId`. Roles are `user`, `assistant`, and `toolResult`. Message timestamps are numeric milliseconds, unlike the header's ISO strings.

Assistant messages retain content blocks, API/provider/model identity, usage, stop reason, and any model error. Tool results retain `toolCallId`, `toolName`, `content`, and `isError`. Matching results must follow completed assistant tool calls before a new conversation turn. The loader rejects unsupported message shapes or incomplete pairing; error/aborted assistant calls are excluded from pairing validation because Pi AI filters those assistants on replay.

There are no stored streaming deltas, drafts, system prompt, tool functions, or model-change entry records. Changing the selected model updates header metadata. Storage is a rewritten full snapshot, not an append-only event journal.

## Read and write

Use `SessionManager.open(path)` and its snapshot accessors rather than editing live files. `commit(messages)` expects complete history. On failure, `flush()` retries the same pending snapshot; see [sessions and recovery](sessions.md).

No migration, automatic repair, or interoperability with Pi's JSONL format is provided. Share only synthetic fixtures: real session cwd and conversation/tool content can disclose local information.

## Source

[Storage types](../core/types/storage.ts), [session-manager.ts](../core/session-manager.ts), [message validation](../core/messages.ts), and [atomic-write.ts](../utils/atomic-write.ts).
