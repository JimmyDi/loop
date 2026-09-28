# Projects and Session Navigation

The sidebar groups historical sessions by project. A project represents a local directory accessible to the backend; a tab represents an open session view.

## Usage

1. Click **Add project** and enter an absolute directory path or use the directory picker.
2. Expand a project to see its history; click the project's **+** button to create a session.
3. Open a history entry and use the top tabs to switch or close views.

A local macOS service can open the system folder picker. Browser-based directory navigation is always available. If native selection fails, the UI shows the error and opens the browser-based alternative. Cancelling selection does not create a project. Directory navigation accesses the computer running the Web service.

## State and Interfaces

| Operation | Request and state |
| --- | --- |
| Query, add, rename, or remove a project | useProjects calls `/api/workspaces` and refreshes the project cache on success |
| Browse or select a directory | useDirectoryPicker queries capabilities and calls the directory API |
| Query history | useProjectSessions caches by workspaceId and queries when the project is expanded and accessible |
| Create a session | Submit workspaceId and open a tab with the returned sessionId |
| Open an existing session | workspace-store deduplicates tabs by sessionId; the view loads a snapshot and subscribes to events |

Sessions without user text show **New session** in the header, history and tabs. When no generated or manual title exists, the first eligible user message supplies the fallback title, including for restored historical sessions. New conversations also make an independent model request to generate a short title in the prompt's language. Saved titles appear in sidebar rows and tabs. Failed generation keeps the existing title. Renaming a project still changes only its display name.

The header contains a folder icon and the session name, without the project path or separate title actions. Hovering or keyboard-focusing the name highlights it. Click to edit with the current text selected; Enter confirms, while Escape or clicking outside cancels. Enter during IME composition does not submit. Blank names cannot be saved; failed saves retain the draft and show an error. Successful saves pin the manual title and update the header, sidebar and tabs immediately. Editing is unavailable during another session operation or pending history save. Title regeneration remains available through the SDK/API, with no header button.

Active sessions receive title updates through SSE, including results arriving after the answer. Expanded project lists refresh every five seconds while the page is visible to pick up background-session changes; saved tab titles also update. Reading untitled history derives a fallback without making a model request or rewriting the session file. See [title policy](../../../coding-agent/docs/session-titles.md).

## Lifecycle and Errors

Closing a tab preserves unsent drafts, keeps history, and does not stop backend generation. Reopening retrieves current state through a snapshot. An unavailable project directory shows **Directory unavailable** and disables new sessions for that project.

Removing a project requires confirmation. If drafts exist, the dialog warns that they will be discarded. After the backend succeeds, the frontend clears that project's tabs, drafts, and unconfirmed requests. Busy sessions or pending saves prevent removal; the frontend retains state and displays the error. Project files and saved conversations remain on disk.

There is no file-tree editor, session deletion, history search, or session transfer between projects. See [project registration](../../backend/docs/projects.md) for backend path normalization and persistence.

## Source and Tests

- [ProjectItem](../components/projects/ProjectItem.tsx) / [tests](../components/projects/ProjectItem.test.tsx).
- [ProjectActions](../components/projects/ProjectActions.tsx) / [tests](../components/projects/ProjectActions.test.tsx).
- [useProjects](../hooks/useProjects.ts) / [tests](../hooks/useProjects.test.tsx).
- [useProjectSessions](../hooks/useProjectSessions.ts) / [tests](../hooks/useProjectSessions.test.tsx).
- [useDirectoryPicker](../hooks/useDirectoryPicker.ts) / [tests](../hooks/useDirectoryPicker.test.tsx).
- [workspace-store](../state/workspace-store.ts) / [tests](../state/workspace-store.test.ts).
- [SessionName](../components/layout/SessionName.tsx) / [tests](../components/layout/SessionName.test.tsx).
- [useSessionRename](../hooks/useSessionRename.ts) / [tests](../hooks/useSessionRename.test.tsx).
