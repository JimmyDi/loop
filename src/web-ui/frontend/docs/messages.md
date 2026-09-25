# Message Rendering

The timeline displays completed history and the current streaming draft. Drafts replace content at a message position; each text delta does not become a separate history entry.

## Supported Content

| Content | Behavior |
| --- | --- |
| User messages | Text and a copy button |
| Assistant text | Markdown, syntax highlighting, tables, and KaTeX math |
| Thinking | Expandable blocks containing only thinking returned by the model |
| Tool calls | Cards with the name, arguments, waiting/running/success/error status, and final result |
| Failed messages | Display errorMessage after streaming ends; errors remain visible when reopening history |

Tool calls and results merge by toolCallId instead of creating duplicate cards. A standalone result without a corresponding assistant call can still be displayed. Tools show actual execution state and final output, with no invented progress or interactive terminal.

## Markdown and Copying

marked and KaTeX convert Markdown, then DOMPurify sanitizes it. Interactive elements such as form controls are removed from model content. Links retain only HTTP(S) targets and use noopener/noreferrer when opening a new window. highlight.js highlights code blocks with recognized languages.

Code-block buttons copy the original code text. The complete assistant message's copy button includes text only, excluding thinking and tool arguments. Copy failures display feedback. The UI is not a full image, audio, or attachment viewer and does not render Mermaid diagrams.

## Scrolling and Lifecycle

Near the bottom, content and container size changes follow the latest message. Scrolling upward stops automatic following and displays **Jump to latest**; clicking it resumes following.

Complete snapshots come from the server. The browser maintains display state only and reloads history after refresh, rather than restoring a separate chat history from browser storage. See [streaming state](events.md).

## Source and Tests

- [MessageTimeline](../components/chat/MessageTimeline.tsx) / [tests](../components/chat/MessageTimeline.test.tsx).
- [AssistantMessage](../components/chat/AssistantMessage.tsx) / [tests](../components/chat/AssistantMessage.test.tsx).
- [ToolCard](../components/chat/ToolCard.tsx) / [tests](../components/chat/ToolCard.test.tsx).
- [Markdown utilities](../lib/markdown.ts) / [security and formatting tests](../lib/markdown.test.ts).
- [useAutoScroll](../hooks/useAutoScroll.ts) / [tests](../hooks/useAutoScroll.test.tsx).
- [Tool projection](../../shared/tool-projection.ts) / [tests](../../shared/tool-projection.test.ts).
