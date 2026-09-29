# Message Rendering

The timeline displays completed history and the current streaming draft. Drafts replace content at a message position; each text delta does not become a separate history entry.

## Supported Content

| Content | Behavior |
| --- | --- |
| User messages | Text and a copy button |
| Assistant text | Markdown, syntax highlighting, tables, and KaTeX math |
| Thinking | Expandable blocks containing only thinking returned by the model |
| Tool calls | Direct tool rows with individual status icons; expand a row to inspect parameters and results |
| Failed messages | Display errorMessage after streaming ends; errors remain visible when reopening history |

Tool calls and results merge by toolCallId instead of creating duplicate cards. A standalone result without a corresponding assistant call can still be displayed. Tools show actual execution state and final output, with no invented progress or interactive terminal.

## Tool Groups and Action Updates

Each user turn has one execution section, rendered by RunActivityCard and ExecutionGroup. Intermediate assistant updates associated with tool calls, thinking blocks, and tool batches appear in order along a shared vertical timeline. Explicitly marked action updates stream immediately inside reasoning, including the first assistant message; marked final answers stream in the separate answer area. Thinking continues streaming in the execution section. Direct text-only answers create no empty section. See [default prompt instructions](../../../coding-agent/docs/context-files.md).

The section header shows elapsed work time and a failure count. While running it updates every second, including when collapsed, for example **Working for 1m 2s**. After execution it freezes at **Worked for 28m 20s**; errors and cancellation retain their status. Chinese labels and seconds/minutes/hours are localized. Timing comes from the server's per-prompt metadata and survives reconnection, refresh and reopening saved history. It includes model preflight and model/tool work, excluding history saves and asynchronous title work. Old history without timing retains its status label; unknown outcomes use Execution details. Missing durations are never inferred from message timestamps.

The execution section's left edge and the Looping indicator align with the final answer's text column, leaving the avatar column clear on desktop and narrow screens. The nested execution-group heading uses up to 90 characters from the user request, excluding attachment bodies, or a generic label when no text is available. Active turns start with expanded execution sections; completed turns loaded from session history start collapsed, showing only the duration/status header. Nested execution groups start expanded when the section is revealed; individual tool parameter/result details start collapsed. Expansion choices persist through subsequent tool batches, timer updates, completion and reconnection.

The execution-group icon follows reasoning and tool activity independently of the whole response. It stops spinning as soon as Pi AI reports thinking_end with no pending tools, or starts streaming answer text, without waiting for the answer to finish. Streaming commentary, further thinking or tool calls restore its running state. SSE snapshots retain the current draft phase across reconnection. The elapsed-work timer and Looping indicator still cover the complete response.

Consecutive tool calls within one assistant message form a batch. Text, thinking, and message boundaries separate batches without reordering content. The sections are projected from existing history and drafts without changing stored messages; timing arrives through the existing SSE envelope. Plain Pi AI text deltas do not identify their display phase. The default prompt asks for a leading `<!-- loop:commentary -->` or `<!-- loop:final -->` marker on each text block. The UI consumes this marker as soon as it is complete, streams following text into the correct area, and hides split markers. When available, Pi AI version-1 textSignature phase metadata takes precedence. Commentary remains in reasoning when tools arrive, and final text remains outside it; text blocks with both phases in one message are separated. These are presentation hints, not permission or execution signals.

Models that omit markers and phase metadata retain the conservative fallback: unclassified text waits for a tool call or message completion, then appears in reasoning or the answer area respectively. This also applies to custom system prompts that omit the marker convention and old history. No wording, Markdown length, or partial stop reason is used to guess the phase. Raw events and history retain the original text; rendering and assistant copy controls omit leading markers. Thinking, tool statuses, elapsed time and the Looping indicator continue updating. Reconnect snapshots use the same projection and preserve known tool execution states.

When a group has no non-empty text since the previous group in that message, the UI adds a brief action label: Read files, Write files, Edit files, Run commands, or Use tools for mixed/unknown tools. Thinking alone is not an action update. Labels use the interface language, do not infer intent from arguments, do not request a model, and are neither saved into history nor included in assistant-message copying. Neutral action labels remain accurate when reopening completed history.

Each tool appears directly as a Used tool row followed by its name and status icon, with no intermediate call-count accordion. Tool batches use compact spacing between action updates and tool rows, with 5px vertical row padding and 6px group margins. They retain a shared left vertical line inset by 5px at both ends and indented rows, with tighter indentation on narrow screens; action updates stay outside that indentation. Tool rows appear as soon as tool-call generation arrives, before execution finishes. The icon to the right of the name spins from tool_execution_start until tool_execution_end, becomes a green check on success or a red cross on failure; queued calls retain a neutral waiting icon. For a live tool that succeeds in under 200ms, its icon completes a minimum 200ms running indication before showing the check, preventing start/end events received in one paint interval from hiding all activity. This local visual transition does not delay results, subsequent tools, final answers, stored status or the accessible status label. Errors and cancellation update immediately; completed history never replays the spinner. Hidden pages and reduced-motion preferences skip the hold, and each tool has its own timer that is cleared on unmount. Failure counts remain visible in the execution-section header even while other calls run. Cancellation retains the existing error results for skipped or cancelled calls rather than inventing successful completion. Expand a tool row to inspect its parameters and result. Tool results have no copy button. Parameters and results use equal-height adjacent panels on desktop, capped at 220px with independent scrolling, and stack on narrow screens.

Tool batches use the first call ID for stable identity and each tool row uses its own call ID; execution sections use session and turn positions. Streaming arguments, added calls, completion, and reconnect snapshots preserve open disclosures while the timeline stays mounted. Reopening a session collapses completed execution sections again, while a still-running turn starts expanded. Expanding a historical section reveals its execution group and tool rows; individual tool details start collapsed again. Different user requests and sessions never share a section. Existing history uses the same grouping without migration; standalone results remain inspectable within the execution section.

## Markdown and Copying

marked and KaTeX convert Markdown, then DOMPurify sanitizes it. Interactive elements such as form controls are removed from model content. Links retain only HTTP(S) targets and use noopener/noreferrer when opening a new window. highlight.js highlights code blocks with recognized languages.

Code-block buttons copy the original code text. The complete assistant message's copy button includes text only, excluding thinking and tool arguments. Copy failures display feedback. The UI is not a full image, audio, or attachment viewer and does not render Mermaid diagrams.

## Scrolling and Lifecycle

Near the bottom, content and container size changes follow the latest message. Scrolling upward stops automatic following and displays **Jump to latest**; clicking it resumes following.

Complete snapshots come from the server. The browser maintains display state only and reloads history after refresh, rather than restoring a separate chat history from browser storage. See [streaming state](events.md).

## Source and Tests

- [MessageTimeline](../components/chat/MessageTimeline.tsx) / [tests](../components/chat/MessageTimeline.test.tsx).
- [AssistantMessage](../components/chat/AssistantMessage.tsx) / [tests](../components/chat/AssistantMessage.test.tsx).
- [RunActivityCard](../components/chat/RunActivityCard.tsx) / [tests](../components/chat/RunActivityCard.test.tsx).
- [RunDuration](../components/chat/RunDuration.tsx) / [timer tests](../components/chat/RunDuration.test.tsx).
- [ExecutionGroup](../components/chat/ExecutionGroup.tsx) renders the ordered steps.
- [Turn projection](../components/chat/timeline-turns.ts) / [tests](../components/chat/timeline-turns.test.ts).
- [ToolCard](../components/chat/ToolCard.tsx) / [tests](../components/chat/ToolCard.test.tsx).
- [ToolGroup](../components/chat/ToolGroup.tsx) / [tests](../components/chat/ToolGroup.test.tsx).
- [Content grouping](../components/chat/assistant-content.ts) / [tests](../components/chat/assistant-content.test.ts).
- [Markdown utilities](../lib/markdown.ts) / [security and formatting tests](../lib/markdown.test.ts).
- [useAutoScroll](../hooks/useAutoScroll.ts) / [tests](../hooks/useAutoScroll.test.tsx).
- [Tool projection](../../shared/tool-projection.ts) / [tests](../../shared/tool-projection.test.ts).
