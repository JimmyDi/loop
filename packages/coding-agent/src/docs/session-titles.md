# Session Titles

Titles identify conversations without adding text to their model history. Coding-agent owns a fallback, optional background model generation, persistence, manual renaming, and cancellation. Agent remains responsible only for individual model loops.

## Usage

This example runs from the repository root with configured model credentials. It makes a main request and an independent title request:

```typescript
import { createAgentSession, SessionManager } from "@loop/coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  tools: [],
  title: { mode: "first-prompt" },
});

try {
  await session.prompt("Explain the project startup scripts");
  await session.waitForTitle();
  console.log(session.state.title?.text);
  await session.renameTitle("Project startup");
} finally {
  await session.abort();
  session.dispose();
}
```

## Policy and API

Pass `title: SessionTitleOptions` to `createAgentSession` or `AgentSession`.

| Option | Default | Meaning |
| --- | --- | --- |
| `mode` | `"off"` | Off keeps deterministic fallback titles without model calls. First-prompt generates once when the first eligible user text arrives in an untitled conversation. All-prompts regenerates on each new eligible user text. |
| `model` | Current conversation model | Optional paired `{ provider, id }`, resolved by the same model runtime. |
| `maxInputBytes` | 16384 | Maximum UTF-8 bytes of the JSON input. Oversized inputs fail without truncating history. |
| `maxOutputTokens` | 256 | Auxiliary response token limit. |
| `timeoutMs` | 15000 | Deadline covering authentication and model generation. |

Numeric limits must be positive safe integers at most 2147483647. Web opts into first-prompt mode; CLI and SDK otherwise make no automatic auxiliary model calls. The policy is supplied by the host on each construction, not persisted in the session.

`state.title` and the header's optional `title` hold `{ text, source, messageIndices, model? }`. Source is fallback, model, or user; indices refer to zero-based conversation message positions used as title input. Manual titles have no source indices. Model identity contains provider and id, never credentials.

- `renameTitle(text)`: normalize and save a manual title; success pins it against automatic changes.
- `refreshTitle()`: explicitly regenerate from saved user text using the chosen mode, or materialize the fallback in off mode. Success replaces a manual pin; failure leaves it intact.
- `waitForTitle()`: wait for background work and writes without cancelling. Inspect `state.titleError`; automatic failures are contained.
- `cancelTitle()`: cancel and drain auxiliary work without aborting a main prompt.

Rename and refresh require an idle session with no pending history save, and reserve it while completing. Automatic generation does not reserve the main prompt slot.

## Lifecycle and errors

The first eligible text produces a fallback immediately: up to eight whitespace-delimited words within 96 UTF-8 bytes. Images and assistant/tool messages never enter title generation. Image-only or empty-text messages wait for eligible text. Existing titles are restored without extra calls. Reading old untitled history derives the same fallback from its first eligible user message, without writing the file or calling a model; it can be regenerated explicitly. Empty sessions have no title metadata and Web displays New session.

The background request uses an independent context, no tools, one model turn, and a short language-aware instruction. The model API is reached through the existing Agent loop and injected model runtime. No title request, response, tool result, or token usage is added to the main conversation; the auxiliary request has its own provider token cost.

Accepted titles are normalized to one line, stripped of terminal/invisible controls, capped at 120 UTF-8 bytes without splitting code points, and saved in the existing JSONL header. Storage writes serialize with model changes and history commits, preserving both. Title-only changes do not alter activity timestamps. A fallback display event can precede its storage write; model/manual title events follow persistence.

New text supersedes in-flight automatic work; all-prompts starts a new revision, while first-prompt does not automatically retry. Manual rename, explicit refresh, model switching, cancellation, runtime replacement, and disposal invalidate older work. Stale completions cannot become the accepted title. The Web backend also cancels and drains titles before provider reconfiguration or project disposal.

Timeouts, missing authentication/model, input overflow, truncated/deferred/error responses, tool calls, empty output, and storage failures retain the previous title. Automatic errors appear in `state.titleError` and `session_title` events without rejecting the main prompt or changing its outcome. Explicit refresh rejects. Use refresh to retry; there is no automatic retry loop.

## Limits

Titles summarize user requests, not assistant answers. Long all-prompts inputs fail at the byte cap instead of compacting. There is no title journal, fork support, search, or cross-process write coordination. Background title work can be cancelled on shutdown; await `waitForTitle()` before disposal when the host wants to retain it.

## Source and tests

- [Title service](../core/titles/session-title.ts) / [tests](../core/titles/session-title.test.ts).
- [Generation](../core/titles/generate-title.ts), [normalization](../core/titles/title-text.ts) / [tests](../core/titles/title-text.test.ts).
- [Storage](../core/session-manager.ts) / [tests](../core/session-manager.test.ts).
- [Events](events.md), [session format](session-format.md), and [Web sessions](../../../web-ui/src/backend/docs/sessions.md).
