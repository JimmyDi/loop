# Chat Input

The composer submits a user message and the backend runs the model and tool loop. The frontend displays activity and provides cancellation and save recovery; it does not execute Agent in the browser.

## Usage

New empty sessions center the input in the conversation area, with the theme-aware Loop icon and **Loop everything** stacked above it. The input returns to the bottom when the conversation starts. Draft text, attachments, model controls and recovery notices remain available in both layouts; short viewports can scroll the welcome area.

New empty sessions show a project capsule in a rounded gray strip attached to the top of the composer. The strip sits 12px inside the input's sides and extends behind its rounded top edge, with a theme-aware background distinct from the conversation. The capsule and project choices use a rounded folder outline with a horizontal divider. Hover or focus gives the capsule a neutral gray background and replaces its folder with a 20px gray circle containing a centered white cross, keeping the project label in place. Clear the capsule to choose a different registered project or add a folder with Create project. Sending requires a selected, accessible project. Switching folders retains unsent input, attachments, model, effort and permissions; saved conversations keep their original project. See [Projects and sessions](projects.md).

The empty input shows **Loop anything...**. Press Enter to send and Shift+Enter for a newline; these shortcuts are not displayed beneath the input. On devices with a coarse primary pointer, Enter inserts a newline; tap Send or use Ctrl/Command+Enter to submit. Enter does not submit during input-method composition. Pasted text is inserted as plain text; pasted files become attachments. During generation, **Stop generating** remains available beside Send when a new draft is ready. The adjacent model pill configures the current model and its supported reasoning effort; see [model settings](models.md). The session header no longer contains a model selector. Its compact layout uses a 48px minimum height and 5px top/bottom padding on desktop and mobile, preserving the folder button and inline title editor.

The input text, caret and attachment previews share a left edge aligned with the **+** button's circular hover background on desktop and mobile. The **+** button's left inset and the Send/Stop button's right inset both use 12px, keeping the circles symmetrically spaced from the composer border.

On devices with a fine primary pointer, creating a new session or switching sessions focuses the input, with the caret at the end of any restored draft. Sending with Enter or the Send button returns focus to the input without scrolling the page on these devices. Touch devices do not automatically open the keyboard on session changes. The input remains editable while sending or generating. Routine response updates do not take focus from other controls. On narrow screens, the app shell fits the visual viewport as the phone keyboard opens, closes or pans the page. Messages that were at the bottom stay above the composer; manually scrolled history keeps its reading position. Pinch zoom does not resize the shell through this keyboard adjustment, and browsers without Visual Viewport support retain the CSS dynamic-viewport layout.

Sending requires a connected session with no pending save and text or at least one image or text file; submissions during generation or a pause enter the queue. New messages are blocked during attachment reads, model or permission changes, save operations, send confirmation, or disconnection. Queued items appear above the composer in execution order. The [permission menu](permissions.md) sits beside the attachment button in the toolbar below the text input; approval cards stay above the composer.

Composer and session error notices, including run cancellation, have an **×** button at the top right. Closing a notice hides that occurrence without changing the draft, attachments, validation rules or recorded session outcome. Reconnection and pending-save recovery remain available. A new error is displayed again, including a repeated failed upload; dismissal does not carry over to another session.

When a remembered conversation returns session_not_found (404), clear only its active selection and open a new independent chat. Unsent drafts and attachments are retained. Other request failures keep the selection for Retry; generic API failures display the backend error detail instead of replacing it with an uninformative label.

## Requests and Drafts

The Compact command shows the estimated context/window percentage and a matching ring. Reopening a nonempty chat or completing compaction locally recomputes this estimate, including the summary and retained messages; no extra model request is made. A disabled Compact item still shows the percentage. The backend reports planner-backed availability; short contexts are disabled before the first click and show a concise reason on hover. Escape or an outside click dismisses the command menu for the current input; editing the text or clearing and retyping `/` opens it again.

Type `/` and choose **Compact**, or submit `/compact`, to summarize older context while preserving complete conversation history. The host selects complete recent turns using projected message estimates, including selected Skill instructions. If all uncompressed turns fit the retention budget, show **Nothing to compact** without calling the model or saving a checkpoint. The notice follows the interface language, appears only once and closes after five seconds or through its Close button. It retains the draft and attachments. After a no-work response, disable another attempt until the conversation history, checkpoint or selected model changes. Delayed compaction state updates do not clear the notice. Starting another operation clears the local notice; it is not retained as a session error. See [context compaction](../../../../coding-agent/src/docs/compaction.md).

Compaction appears at the end of the conversation with a compact outline icon and **Working for** elapsed time above a thin divider. After 15 seconds, add **This can take a few minutes**; elapsed time comes from the server’s operation start and survives refresh or reconnection to the live server. The composer keeps its ordinary background, temporarily hides slash-command text and offers **Stop generating**. Failure or cancellation restores the command draft and preserves attachments and Skills. Success leaves **Context compacted** at the checkpoint’s original history position; the latest saved checkpoint restores this marker when reopening. The marker is interface metadata, not a new conversation message, and is withheld while a save remains pending. Starting compaction reveals the status once; later updates preserve manual scrolling.

| State | Behavior |
| --- | --- |
| Before submission | usePrompt creates a requestId and records text, images, text files and streamId |
| Sending | Keep the input editable; block another submission until delivery is confirmed |
| HTTP acceptance | Release unchanged submitted text, attachments and Skills; allow a new submission. A 202 is not a successful answer |
| Generating | Keep the next draft editable; further sends enter the queue. With existing queued items and draft text or attachments, show only Send; restore Stop when the draft is empty |
| Successful completion | Preserve the new draft; start the next queued input |
| Failure or cancellation | Preserve the new draft and unconsumed queue; Stop exposes Resume |
| Lost response | Retain the unconfirmed request and block sending it again with a new ID |

Sending and HTTP acceptance are tracked across session switches within the current page. Only the request payload is persisted: after a reload, an unmatched saved request requires confirmation again. A changed server event stream also makes an unmatched accepted request uncertain. The delivery warning appears for unresolved requests, not for ordinary HTTP or SSE latency.

**Check and retry same request** first fetches the backend snapshot. If the original requestId was accepted, it does not execute again. Otherwise, it resends the original ID only within the same event stream. A changed streamId after a restart reports delivery_unknown and requires inspecting history first. See [backend session commands](../../backend/docs/sessions.md) for deduplication limits.

Prompt delivery and read-only API checks time out after 30 seconds, including response-body reads. A timeout or HTTP 5xx preserves the original request identity for confirmation; no automatic resend occurs. Slow administrative commands retain their existing lifecycle rather than using this prompt timeout. Browser prompts carry the observed streamId so the server also rejects a restart between status confirmation and submission.

## Cancellation, Waiting, and Save Failures

**Stop generating** calls the abort endpoint and waits for cleanup. It retains the queue and pauses draining. Keep the text already streamed in history with a muted “You stopped after” duration and divider above that attempt (localized in Chinese). Each Resume appends another response segment with its own duration; prior stopped text and labels remain visible through reconnect and reopening. Partial text is retained for display as aborted history and is excluded from model replay, so the resumed model may regenerate earlier wording. Once the server reports a resumable task, the composer replaces its Send arrow with a black circular **Resume** button containing a white right-pointing triangle. Resume works with an empty input and continues the stopped task from completed history without submitting or clearing the current draft. The queue shows its retained items and pause status without a separate Resume button. Disconnects, pending saves and active composer operations disable Resume; failures keep it available for retry. Switching sessions or disconnecting the event stream does not cancel the model request.

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

Unsent attachments stay in memory across session switches; refreshing discards them. Unconfirmed requests retain the exact images and text files with their request identity for retry, subject to browser storage availability. Acceptance clears unchanged submitted attachments. Later failures do not restore them over the next draft. Queued text is editable; sent-history editing, regeneration and automatic retries are not supported.

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

## Queue Controls

Messages display oldest to newest in an inset panel joined to the top of the input. Each compact row shows a single-line text preview with the full text on hover, followed by Steer, a delete icon and a more-options menu. Choose **… → Edit** to edit the complete message in the main chat input after the server confirms an editing hold. Hide the corresponding queue row while it is in the composer; the server keeps its reserved position and skips it so later messages can run. Load the full text, images, file bodies and selected Skills into the composer, temporarily saving the previous unsent draft. Send saves the edited content and Skills at the original reserved position if no later message has been dispatched during editing. Once a later message starts, sending appends the edited item to the queue after all remaining and newly queued messages, without interrupting the active response. Editing uses the ordinary composer surface without an editing banner or Cancel control. Show only one black Send arrow while editing, including during generation or a paused task; hide Stop and Resume until the edit is sent. Empty edits disable Send. A confirmed save restores the previous composer draft and the normal generation controls. Failed saves keep the editor and hold. Disable editing another queued item until the current edit is sent. Session switches retain the editor in memory; a page refresh keeps the server hold but loses the local edit mode and unsaved attachment changes, so the held row can be reopened through **… → Edit**. The delete icon removes an item. The options menu supports keyboard navigation, Escape and outside-click dismissal without being clipped by the queue scroll area. Hover or focus a row to reveal its dotted drag grip beside the queue icon. Dragging uses a full-row preview, dims the placeholder and smoothly shifts neighboring rows into the proposed order when the pointer crosses each original row midpoint. Drop commits one move, including moves after a row or to the end; dropping in the original slot sends no command. Dragging near the scroll edges scrolls the queue. Cancelling, disconnecting or receiving a changed queue clears the preview without submitting a stale move. Focused handles also support Up/Down keys; reduced-motion settings remove the transitions.

Steer marks any item to run after the current response and entire tool batch, before another model call. The selected item displays a waiting state and locks editing/deletion until consumed. When paused, Steer starts the selected input immediately. Stale IDs reject rather than recreating consumed work; use authoritative SSE state before retrying.

Queues and paused state survive page refresh and reconnect to the live server. Server restart or instance disposal discards them. Resume requests continuation from complete history without restoring a stream cursor or replaying finished tools. See [core scheduling](../../../../coding-agent/src/docs/message-queue.md), [queue UI](../components/chat/MessageQueue.tsx) and [tests](../components/chat/MessageQueue.test.tsx).

## New and independent chats

The main area always uses ChatWorkspace. With no selected session it opens an in-process independent draft, displays the empty conversation greeting and the same composer used for history. The first accepted user message replaces only the greeting with the timeline; the composer stays mounted. Empty drafts are excluded from sidebar history and do not persist across backend restarts. A provider must be configured before opening a new draft; creation errors expose Retry.

The project selector shows **No project** by default. Before the first message, select a registered project or remove the selection to start an independent chat. Selecting a different scope creates a new empty handle and transfers unsent text, attachments and model/permission choices. A conversation containing messages cannot change project ownership.

Independent conversations appear under **Chats**. Pinned conversations appear only under **Pinned**. Both use the same session row actions as project conversations. Chats, Pinned and the Projects list initially show five entries; **Show more** reveals ten additional entries per click. Each section supports folding and heading navigation. Empty Chats and Pinned sections are hidden.
