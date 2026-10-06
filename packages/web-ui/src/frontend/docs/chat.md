# Chat Input

The composer submits a user message and the backend runs the model and tool loop. The frontend displays activity and provides cancellation and save recovery; it does not execute Agent in the browser.

## Usage

New empty sessions center the input in the conversation area, with the theme-aware Loop icon and **Loop everything** stacked above it. The input returns to the bottom when the conversation starts. Draft text, attachments, model controls and recovery notices remain available in both layouts; short viewports can scroll the welcome area.

New empty sessions show a project capsule in a rounded gray strip attached to the top of the composer. The strip sits 12px inside the input's sides and extends behind its rounded top edge, with a theme-aware background distinct from the conversation. The capsule and project choices use a rounded folder outline with a horizontal divider. Hover or focus gives the capsule a neutral gray background and replaces its folder with a 20px gray circle containing a centered white cross, keeping the project label in place. Clear the capsule to choose a different registered project or add a folder with Create project. Sending requires a selected, accessible project. Switching folders retains unsent input, attachments, model, effort and permissions; saved conversations keep their original project. See [Projects and sessions](projects.md).

The empty input shows **Loop anything...**. Press Enter to send and Shift+Enter for a newline; these shortcuts are not displayed beneath the input. Enter does not submit during input-method composition. Pasted text is inserted as plain text; pasted files become attachments. During generation, the send button becomes **Stop generating**. The adjacent model pill configures the current model and its supported reasoning effort; see [model settings](models.md). The session header no longer contains a model selector. Its compact layout uses a 48px minimum height and 5px top/bottom padding on desktop and mobile, preserving the folder button and inline title editor.

The input text, caret and attachment previews share a left edge aligned with the **+** button's circular hover background on desktop and mobile. The **+** button's left inset and the Send/Stop button's right inset both use 12px, keeping the circles symmetrically spaced from the composer border.

Creating a new session or switching sessions focuses the input, with the caret at the end of any restored draft. Sending with Enter or the Send button returns focus to the input without scrolling the page. The input remains read-only while sending or generating. Routine response updates do not take focus from other controls.

Sending requires a connected, idle session with no pending save or approval and text or at least one image or text file. New messages are blocked during attachment reads, model or permission changes, save operations, send confirmation, or disconnection. There is no input queue. The [permission menu](permissions.md) sits beside the attachment button in the toolbar below the text input; approval cards stay above the composer.

Composer and session error notices, including run cancellation, have an **×** button at the top right. Closing a notice hides that occurrence without changing the draft, attachments, validation rules or recorded session outcome. Reconnection and pending-save recovery remain available. A new error is displayed again, including a repeated failed upload; dismissal does not carry over to another session.

When a remembered conversation returns session_not_found (404), clear only its active selection and return to the welcome screen. Unsent drafts and attachments are retained. Other request failures keep the selection for Retry; generic API failures display the backend error detail instead of replacing it with an uninformative label.

## Requests and Drafts

| State | Behavior |
| --- | --- |
| Before submission | usePrompt creates a requestId and records text, images, text files and streamId |
| Sending | Keep the input read-only and block duplicate submissions without showing a delivery warning |
| HTTP acceptance | The backend returns 202; wait for the matching SSE state without a delivery warning and keep sending blocked. A 202 is not a successful answer |
| Generating | Once the matching user message arrives, the composer temporarily hides the submitted text |
| Successful completion | Clear the draft if it still matches the submitted text, then clear the request record |
| Failure or cancellation | Preserve the draft, display the error or cancellation state, and allow submission after recovery |
| Lost response | Retain the unconfirmed request and block sending it again with a new ID |

Sending and HTTP acceptance are tracked across session switches within the current page. Only the request payload is persisted: after a reload, an unmatched saved request requires confirmation again. A changed server event stream also makes an unmatched accepted request uncertain. The delivery warning appears for unresolved requests, not for ordinary HTTP or SSE latency.

**Check and retry same request** first fetches the backend snapshot. If the original requestId was accepted, it does not execute again. Otherwise, it resends the original ID only within the same event stream. A changed streamId after a restart reports delivery_unknown and requires inspecting history first. See [backend session commands](../../backend/docs/sessions.md) for deduplication limits.

## Cancellation, Waiting, and Save Failures

**Stop generating** calls the abort endpoint and waits for cleanup. Switching sessions or disconnecting the event stream does not cancel the model request.

While a connected session is generating a response, **Looping...** appears after the latest content in the conversation with a highlight sweeping from left to right. It remains visible while waiting for the model, streaming text or thinking, and executing tools, then disappears when the prompt ends or the connection is lost. Reduced-motion and forced-color preferences use a static label. Routine session labels such as Ready, Running and Completed no longer appear above the input. Reconnection, errors and save recovery remain visible when needed. Provider configuration and the current session's model are separate choices; see [model settings](models.md) for troubleshooting.

When hasPendingSave is true, the status area offers **Retry save**. flush saves existing results without requesting the model or executing tools again. Sending and model changes remain blocked until saving succeeds.

## Attachments

Use the **+** button at the lower left of the composer to open the **Add** menu, then choose **Files** (the paperclip item). The picker allows selecting images and UTF-8 text/code files together. The menu supports keyboard navigation, Escape and outside-click dismissal. Images and text/code files can also be pasted into the input together. Preview and remove attachments before sending; attachment-only messages are supported.

The picker filters for supported image types and text/code extensions, excluding PDF, PowerPoint and other unsupported formats by default. Browsers may allow overriding this filter; attachment validation still rejects unsupported files. Extensionless files such as Makefile can be pasted when the system picker hides them.

- Images: up to four PNG, JPEG, WebP or GIF images per message, totaling at most 3 MiB. Known text-only models reject images before sending; custom gateways forward them to the service without a capability checkbox.
- Text files: up to four files, with no application-imposed per-file or combined text byte limit. Supported extensions include TXT, Markdown, JSON, CSV, YAML and common source/configuration formats; extensionless files such as Makefile are also supported. See [the extension list](../../shared/prompt-files.ts).

Text files are decoded as UTF-8 without a parser; an optional UTF-8 BOM is removed, and whitespace is preserved. Invalid UTF-8, binary control characters and unsupported extensions reject with a visible error; contents are never silently truncated. PDF, Office documents, archives and non-UTF-8 encodings are not supported. Prompt JSON bodies have no application-imposed byte limit; image-specific limits still apply.

Loop sends the full text to the model without a local estimated-context rejection. Actual model/provider context limits and browser/server memory still apply; provider failures use the existing error flow and retain drafts and attachments. Files are read and serialized in memory, not stored separately for on-demand reading. Automatic compaction and chunked file retrieval are not implemented.

Click a text attachment's filename to expand its plain-text preview. Sent files appear as compact pills above the message, displaying a file icon, filename and extension; long names shorten while the extension stays visible. Pills wrap and align to the right, alongside right-aligned image previews. Filenames and contents are sent as native text blocks and stored with the session; restored history renders the same expandable pills. No original file is written into the project.

Unsent attachments stay in memory across session switches; refreshing discards them. Unconfirmed requests retain the exact images and text files with their request identity for retry, subject to browser storage availability. Successful completion clears matching attachments; failures retain them. Message editing, regeneration, automatic retries and queued submissions are not supported.

## Source and Tests

- [ChatComposer](../components/chat/ChatComposer.tsx) / [tests](../components/chat/ChatComposer.test.tsx).
- [useComposerInput](../hooks/useComposerInput.ts) / [tests](../hooks/useComposerInput.test.tsx).
- [ComposerAttachments](../components/chat/ComposerAttachments.tsx) / [tests](../components/chat/ComposerAttachments.test.tsx).
- [ComposerAddMenu](../components/chat/ComposerAddMenu.tsx) / [tests](../components/chat/ComposerAddMenu.test.tsx).
- [useComposerAttachments](../hooks/useComposerAttachments.ts) / [tests](../hooks/useComposerAttachments.test.tsx).
- [Text file decoding](../lib/read-text-file.ts) / [tests](../lib/read-text-file.test.ts).
- [Text file contract](../../shared/prompt-files.ts) / [tests](../../shared/prompt-files.test.ts).
- [usePrompt](../hooks/usePrompt.ts) / [tests](../hooks/usePrompt.test.tsx).
- [request-store](../state/request-store.ts) / [tests](../state/request-store.test.ts).
- [SessionStatus](../components/chat/SessionStatus.tsx) / [tests](../components/chat/SessionStatus.test.tsx).
- [LoopingIndicator](../components/chat/LoopingIndicator.tsx) / [translation fallback test](../components/chat/LoopingIndicator.test.tsx), displayed by [MessageTimeline](../components/chat/MessageTimeline.tsx) / [tests](../components/chat/MessageTimeline.test.tsx).
