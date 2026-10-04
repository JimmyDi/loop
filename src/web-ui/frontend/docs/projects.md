# Projects and Session Navigation

The sidebar groups historical sessions by project. A project represents a local directory accessible to the backend. The main area displays one selected session.

All projects sit beneath the **Projects** disclosure, expanded by default. Click its label or chevron to collapse or expand the whole list; the chevron points down when expanded and right when collapsed. Collapsing preserves the selected session and each project's own expansion state. **Add project** and **Settings** remain available in either state.

The Projects heading uses 14px text and sits close to the first project row. Its chevron and **+** button appear while hovering over the heading row or navigating its controls with the keyboard. They hide when the pointer leaves, without shifting the label or layout. Devices without hover keep the controls visible. The heading's Add project button, each project's New session button and each session's Archive button share the same right edge, with 30px buttons, 20px icons and consistent rounded hover styling.

Session titles, inline rename text and the **No chats** placeholder align with the project name. Project and session names use 13px text, while **No chats** uses 14px. Project and session names share the same foreground color across default, hover, focus and selected states: soft white in Dark and dark text in Light. **Projects** uses a subdued gray, with **No chats** softer still, in both themes. Project and session row highlights share the same left and right edges; text indentation stays inside each row. Adjacent session rows have a 2px gap so hover and selection highlights stay separate.

## Usage

1. Click **Add project** and enter an absolute directory path or use the directory picker. After saving, the Projects group and the added project expand, and the project scrolls into view and receives keyboard focus. Empty projects show **No chats** without creating a session. Adding an already registered folder reveals its existing node without duplication. Failed saves retain the dialog and entered path for retry.
2. Click the project row to expand or collapse its history; the folder icon opens and closes with it. Hover or keyboard focus highlights the row and reveals **…** and the compose pencil. Touch devices keep these actions visible. Click the pencil to open a new draft. It becomes a sidebar session only after its first user message is accepted into the conversation.
3. Each project initially shows up to five history entries. If more exist, click **Show more** to reveal the next ten, or all remaining entries when fewer than ten remain. The button disappears when all entries are visible. Click a history entry to select it. Switch conversations through the sidebar; the folder button opens the project drawer on narrow screens.
4. Hover or keyboard-focus a session row to highlight it and reveal its Archive button. Click Archive to archive that chat immediately. Right-click the title, or press Shift+F10 while it has focus, to open Rename, Archive and Permanently delete without switching the selected chat.

A local macOS service can open the system folder picker. Browser-based directory navigation is always available. If native selection fails, the UI shows the error and opens the browser-based alternative. Cancelling selection does not create a project. Directory navigation accesses the computer running the Web service.

## State and Interfaces

| Operation | Request and state |
| --- | --- |
| Query, add, rename, or remove a project | useProjects calls `/api/workspaces` and refreshes the project cache on success |
| Browse or select a directory | useDirectoryPicker queries capabilities and calls the directory API |
| Query history | useProjectSessions caches by workspaceId and queries when the project is expanded and accessible |
| Reveal more history | SessionList displays five cached summaries initially and adds up to ten per click, independently for each project |
| Start a draft | Submit workspaceId and select the returned draft handle; no history file or sidebar item is created yet |
| Open an existing session | workspace-store records the selected session and its project; the view loads a snapshot and subscribes to events |

Drafts show **New session** in the header but do not appear under their project. Typing, adding attachments, changing models, renaming the header or clicking New session repeatedly does not create sidebar items. The first user message adds the item during the run; an image-only or file-only message also counts. Empty submissions and preflight failures do not create items. Older unarchived records without user messages are hidden without deleting their files. When no generated or manual title exists, the first eligible user text supplies the fallback title, including for restored historical sessions. New conversations also make an independent model request to generate a short title in the prompt's language. Saved titles appear in the header and sidebar rows. Failed generation keeps the existing title. Project renaming remains available through the API; the previous inline Rename/Remove links are replaced by the project menu.

The header contains only a folder icon and the session name above a single divider. Its folder icon matches the collapsed project icon in shape, size and stroke. Its background matches the conversation, with compact spacing between the left border, folder and title. Long titles truncate to fit. Hovering or keyboard-focusing the name highlights it, with 8px padding on either side of the text. The padding stays consistent during hover and editing. Click to edit with the current text selected; Enter confirms, while Escape or clicking outside cancels. Enter during IME composition does not submit. Blank names cannot be saved; failed saves retain the draft and show an error. Successful saves pin the manual title and update the header and sidebar immediately. Editing is unavailable during another session operation or pending history save. Title regeneration remains available through the SDK/API, with no header button.

Active sessions receive title updates through SSE, including results arriving after the answer. A page-level list event stream refreshes affected project lists when background sessions change, including late titles, and resynchronizes lists on reconnect. There is no periodic list polling. Reading untitled history derives a fallback without making a model request or rewriting the session file. See [list synchronization](events.md#list-synchronization) and [title policy](../../../coding-agent/docs/session-titles.md).

A small rotating ring at the far right of a session row indicates response generation, including model waiting, streaming and tool execution. Live session events update the open session immediately; background sessions refresh through list change notifications. The ring disappears when generation ends and does not appear for model changes, saves or title updates. Long titles truncate before the ring. Reduced-motion preferences keep the ring static.

Switching to another session preserves the previous session's latest live status in the list cache before closing its subscription. Older pending list requests are cancelled and a fresh summary is requested, keeping its ring visible during the handoff. Background list updates clear the ring when generation finishes, including cancellation and failure.

After generation ends with new output, an 8px blue dot replaces the ring until the latest content has been viewed. Its tooltip and accessible label are **Unread** / **未读**. Selecting a session alone does not clear it: the completed content must reach the conversation viewport in a visible, focused browser page. Scrolling to the latest content or opening a completed chat at its latest content clears the dot; staying at the submitted user message while a longer answer grows leaves it unread. Hidden pages, open dialogs and the mobile sidebar overlay do not mark messages read. Generation keeps the ring instead of the dot.

Read turn positions persist in this browser's local storage and survive session switches and reloads; unavailable storage keeps them for the current page only. Background sessions use the same completed-turn identity from list refreshes, including when reopening a collapsed project or reconnecting. Title/model changes and save retries do not create unread turns. A cancelled or failed run with saved output can be unread; a run with only a user message cannot. Older history without run timing metadata has no unread indicator. Read receipts are local to the browser and are not synchronized across devices.

## Lifecycle and Errors

Revealing more entries changes only the visible portion of the cached session list; it does not make another history request. List refreshes retain the current display limit. Collapsing and reopening a project or the Projects group, or reloading the page, resets the limit to five.

The session context menu supports arrows, Home/End and Escape, fits within the viewport and stays above sidebar scrolling. **Rename** edits the row inline: Enter saves, Escape or blur cancels, and failed saves retain the input. **Archive** immediately removes only that session from the sidebar and keeps its history, drafts and attachments for restoration from Settings. Neither action asks for confirmation. **Permanently delete** opens a confirmation warning that the chat and its saved messages will be deleted irreversibly. Cancel and Close do not submit; the confirmation disables closing and duplicate submission while pending. Success removes the history file, clears only that chat's local drafts, attachments and pending request, and closes it if selected. Failures retain local data. Deletion errors stay inside the confirmation dialog; closing it or choosing a new row action clears the previous error, so it does not appear under the session title or carry into a new confirmation. Known busy sessions disable row actions; the backend also rejects archive and deletion while any session in the project is busy or has pending saves.

Switching sessions preserves unsent drafts and in-memory image attachments, keeps history, and does not stop backend generation. Returning retrieves current state through a snapshot. Reloading restores the selected session. An unavailable project directory shows **Directory unavailable** and disables new sessions for that project.

The project **…** button and right-clicking the project row open the same menu containing **Archive chats** and **Remove project**, separated by a divider. Both items use the same neutral text and icon color. Right-clicking does not expand, collapse or select a session. Arrow keys and Home/End navigate; Escape closes and restores focus. The menu stays within the viewport and is not clipped by sidebar scrolling.

**Archive chats** loads all currently unarchived chats even when the project is collapsed, then asks for confirmation with their count and project name. **Archive all** archives exactly that confirmed selection; chats created afterward remain visible. Archived history is preserved on disk and excluded from the sidebar. The selected chat closes after success, while drafts, attachments and unconfirmed requests remain intact. Open **Settings → Archived → Archived chats** to view and restore chats from registered, accessible projects. **Unarchive** returns a chat to its project list. Re-add a removed directory to access its archived chats again.

The archive page groups chats into rounded project cards, with folder icons, chat counts, titles and localized last-update timestamps. Filter by project or by all chats, chats with messages, and empty chats. There is no search field. Click a title to open the chat and close Settings. The trash button deletes one archived chat; the project menu deletes all archived chats in that project; **Delete all** targets every loaded archived chat, regardless of filters. Each deletion requires a second confirmation with its exact count and a permanent-deletion warning. Project files and unarchived chats are preserved. Local drafts and unconfirmed requests are cleared only for successfully deleted chats. Requests run project by project; if one fails, already completed deletions remain completed and the confirmation shows the remaining selection for retry.

**Remove project** requires confirmation explaining that local files and saved chats will remain. If drafts or unconfirmed requests exist, the dialog additionally warns that unsent data will be discarded. After the backend succeeds, the frontend clears that project's drafts, attachments and unconfirmed requests. If its session is selected, the main area returns to the welcome screen. Busy sessions, pending creation/loading or pending saves prevent archive, restore and removal; failures retain frontend state and display an error in the dialog. Cancel, Escape and the close button do not submit changes; closing and repeat submissions are disabled during the request.

There is no file-tree editor, history search, or session transfer between projects. See [project registration](../../backend/docs/projects.md) for backend path normalization and persistence.

## Source and Tests

- [Sidebar](../components/layout/Sidebar.tsx) / [tests](../components/layout/Sidebar.test.tsx).
- [SessionItem](../components/projects/SessionItem.tsx) / [tests](../components/projects/SessionItem.test.tsx).
- [Unread row indicators](../components/projects/SessionList.test.tsx), [read receipts](../hooks/useReadReceipt.ts) / [tests](../hooks/useReadReceipt.test.tsx), and [read state](../state/read-store.ts) / [tests](../state/read-store.test.ts).
- [Session actions](../hooks/useSessionActions.ts) / [tests](../hooks/useSessionActions.test.tsx).
- [ProjectItem](../components/projects/ProjectItem.tsx) / [tests](../components/projects/ProjectItem.test.tsx).
- [ProjectActions](../components/projects/ProjectActions.tsx) / [tests](../components/projects/ProjectActions.test.tsx).
- [Confirmation dialogs](../components/projects/ProjectConfirmation.tsx) / [tests](../components/projects/ProjectConfirmation.test.tsx).
- [Archived chats](../components/settings/ArchivedChats.tsx) / [tests](../components/settings/ArchivedChats.test.tsx).
- [useProjects](../hooks/useProjects.ts) / [tests](../hooks/useProjects.test.tsx).
- [useProjectSessions](../hooks/useProjectSessions.ts) / [tests](../hooks/useProjectSessions.test.tsx).
- [useDirectoryPicker](../hooks/useDirectoryPicker.ts) / [tests](../hooks/useDirectoryPicker.test.tsx).
- [workspace-store](../state/workspace-store.ts) / [tests](../state/workspace-store.test.ts).
- [SessionName](../components/layout/SessionName.tsx) / [tests](../components/layout/SessionName.test.tsx).
- [useSessionRename](../hooks/useSessionRename.ts) / [tests](../hooks/useSessionRename.test.tsx).
