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

History entries use creation time as their display title; newly created tabs show **New session**. Session title editing and automatic summary titles are not supported. Renaming a project changes its display name, not its directory on disk.

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
