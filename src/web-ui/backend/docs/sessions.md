# Session Commands

Each sessionId has one writable AgentSession in the current Web process. Web manages commands and event connections; the coding-agent SDK owns model loops, tools, and JSONL history storage.

## API

| Endpoint | Input and result |
| --- | --- |
| GET /api/sessions?workspaceId=… | Return project history summaries without session file paths |
| POST /api/sessions | Accept workspaceId; return a new session snapshot with 201 |
| GET /api/sessions/:id | Open or retrieve a session and return its complete snapshot |
| POST /api/sessions/:id/prompt | Accept requestId and text; return runId with 202 |
| POST /api/sessions/:id/abort | Wait for cancellation and cleanup, then return a snapshot |
| POST /api/sessions/:id/flush | Retry saving existing results and return a snapshot |
| PUT /api/sessions/:id/model | Accept provider and id; return a snapshot after switching |
| PUT /api/sessions/:id/title | Accept nonempty title; normalize, save and pin it against automatic generation |
| POST /api/sessions/:id/title | Regenerate from saved user text; return the snapshot on completion |

A complete snapshot contains model identity, supported efforts, selected effort, SDK state, operation, tool projection, and optional runId/requestId. operation is idle, prompt, model, flush, or title; it does not indicate whether model text has started arriving.

Web enables first-prompt title generation through coding-agent. List summaries include optional title text; snapshots expose title source and optional titleError in SDK state. Background title events publish session.state without changing the operation or opening a run. Explicit title commands share the command lock. Provider reconfiguration and project removal cancel and drain auxiliary work before changing its runtime or disposing sessions. See [session titles](../../../coding-agent/docs/session-titles.md).

## Creation and Restoration

LoopBridge lists a project's sessions through the public SDK, then opens SessionManager from the matching record. Unknown session IDs or history outside registered projects are rejected. Browsers cannot supply arbitrary file paths. Concurrent loads of one sessionId share a Promise and instance.

New sessions use the valid remembered Web model/effort or first configured model; with no provider file, legacy SDK defaults remain available. Restored sessions retain saved model identity and effort. Missing models do not block reading history, but prompts require a configured model. Changing Web defaults does not update existing sessions. See [provider configuration](providers.md).

## Submission and Mutual Exclusion

1. Validate nonempty text and a requestId of at most 128 characters.
2. Synchronously reserve command state, record requestId/runId, and publish run.accepted.
3. Call session.prompt asynchronously; return 202 without waiting for the full answer.
4. Forward message, tool, and agent_settled events, then publish session.state on completion.

A session's prompt, model, and flush operations are mutually exclusive, with no command queue. hasPendingSave blocks new prompts and model changes; only flush can retry saving. Different sessions have separate controllers, while provider updates also use a global exclusion guard.

The controller deduplicates up to 256 recent request IDs. The same ID and text return the original runId without executing again; the same ID with different text returns request_conflict. This cache is in memory, so restart or eviction removes the exactly-once protection.

## Cancellation, Failure, and Disposal

abort is independent of ordinary command locking and can stop an accepted request. It waits for SDK cancellation and the active operation. Disconnecting SSE does not call abort. Lower layers handle model/tool cancellation through signals; completed side effects cannot be undone.

SDK save failures retain hasPendingSave. flush neither requests the model nor executes tools again, and another save failure leaves recoverable state intact. Preflight or unexpected errors also settle to idle with error details, preventing the UI from remaining permanently busy.

Closing a tab does not dispose its session. Instances remain until project removal or server shutdown. There is no automatic idle eviction, session deletion, branching, or cross-process write coordination. See [coding-agent sessions](../../../coding-agent/docs/sessions.md) for complete history and save-failure semantics.

## Image Attachments

POST /api/sessions/:id/prompt accepts text and optional images (native image blocks containing type, data and mimeType). Text may be empty when images are present. Up to four PNG/JPEG/WebP/GIF images totaling 3 MiB decoded are accepted; the prompt JSON body limit is 5 MiB, while other routes retain 1 MiB. Malformed/oversized image payloads reject before starting an operation. Known text-only models return model_images_unsupported.

The request identity includes text and image content; retrying the same requestId with changed images returns request_conflict. Only a content digest is retained in the bounded deduplication map. Pi AI receives the native image blocks, and session history retains them for reload and later turns.

## Model and Effort Updates

PUT /api/sessions/:id/model accepts provider, id and optional effort. Values are default, off, minimal, low, medium, high, xhigh or max; non-default values must be supported by the selected model. Invalid levels return invalid_model_effort (400). Omitted effort preserves the existing level when supported, otherwise Default. Updates run through the existing model command lock and return/publish the complete snapshot; they never call generation. Session metadata and the new-session Web preference are saved before success is returned.

## Source and Tests

- [SDK bridge](../loop.ts) / [tests](../loop.test.ts).
- [Session routes](../routes/sessions.ts), [shared snapshot types](../../shared/protocol.ts).
- [SessionRegistry](../session-registry.ts) / [tests](../session-registry.test.ts).
- [SessionController](../session-controller.ts) / [streaming, cancellation, and save tests](../session-controller.test.ts).
