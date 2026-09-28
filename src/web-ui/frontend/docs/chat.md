# Chat Input

The composer submits a user message and the backend runs the model and tool loop. The frontend displays activity and provides cancellation and save recovery; it does not execute Agent in the browser.

## Usage

Press Enter to send and Shift+Enter for a newline. Enter does not submit during input-method composition. Pasted text is inserted as plain text; pasted images become attachments. During generation, the send button becomes **Stop generating**. The adjacent model pill configures the current model and its supported reasoning effort; see [model settings](models.md). The session header no longer contains a model selector.

Sending requires a connected, idle session with no pending save and text or at least one image. New messages are blocked during model changes, save operations, send confirmation, or disconnection. There is no input queue.

## Requests and Drafts

| State | Behavior |
| --- | --- |
| Before submission | usePrompt creates a requestId and records text, images and streamId |
| HTTP acceptance | The backend returns 202; the final result arrives over SSE. A 202 is not a successful answer |
| Generating | Once the matching user message arrives, the composer temporarily hides the submitted text |
| Successful completion | Clear the draft if it still matches the submitted text, then clear the request record |
| Failure or cancellation | Preserve the draft, display the error or cancellation state, and allow submission after recovery |
| Lost response | Retain the unconfirmed request and block sending it again with a new ID |

**Check and retry same request** first fetches the backend snapshot. If the original requestId was accepted, it does not execute again. Otherwise, it resends the original ID only within the same event stream. A changed streamId after a restart reports delivery_unknown and requires inspecting history first. See [backend session commands](../../backend/docs/sessions.md) for deduplication limits.

## Cancellation, Waiting, and Save Failures

**Stop generating** calls the abort endpoint and waits for cleanup. Closing a tab or disconnecting its event stream does not cancel the model request.

When a request has been accepted but has no assistant draft or running tool, the status area shows **Waiting for the model to respond**. This does not mean text is being generated. Connection errors appear in the status area and saved error messages. Provider configuration and the current session's model are separate choices; see [model settings](models.md) for troubleshooting.

When hasPendingSave is true, the status area offers **Retry save**. flush saves existing results without requesting the model or executing tools again. Sending and model changes remain blocked until saving succeeds.

Attach images with the paperclip button or paste them into the input. Preview and remove them before sending; image-only messages are supported. Each message accepts up to four PNG, JPEG, WebP or GIF images, totaling at most 3 MiB. Known text-only models reject images before sending; custom gateways forward them to the service without a capability checkbox. Submitted images appear in conversation history and persist with the session.

Unsent images stay in memory across tab switches; refreshing discards them. Unconfirmed requests retain the exact images with their request identity for retry, subject to browser storage availability. Successful completion clears matching attachments; failures retain them. Message editing, regeneration, automatic retries and queued submissions are not supported.

## Source and Tests

- [ChatComposer](../components/chat/ChatComposer.tsx) / [tests](../components/chat/ChatComposer.test.tsx).
- [useComposerInput](../hooks/useComposerInput.ts) / [tests](../hooks/useComposerInput.test.tsx).
- [ComposerAttachments](../components/chat/ComposerAttachments.tsx) / [tests](../components/chat/ComposerAttachments.test.tsx).
- [useComposerImages](../hooks/useComposerImages.ts) / [tests](../hooks/useComposerImages.test.tsx).
- [usePrompt](../hooks/usePrompt.ts) / [tests](../hooks/usePrompt.test.tsx).
- [request-store](../state/request-store.ts) / [tests](../state/request-store.test.ts).
- [SessionStatus](../components/chat/SessionStatus.tsx) / [tests](../components/chat/SessionStatus.test.tsx).
