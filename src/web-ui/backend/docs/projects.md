# Projects and Directories

Project registration maps a local directory to a workspaceId so the browser can create and restore sessions. Removing registration does not delete the directory or SDK conversation history.

## Project API

| Endpoint | Input and result |
| --- | --- |
| GET /api/workspaces | Return id, name, cwd, and accessible |
| POST /api/workspaces | Accept path and optional name; return the registered project |
| PATCH /api/workspaces/:id | Accept name and update the display name |
| DELETE /api/workspaces/:id | Remove registration; return 204 on success |
| POST /api/workspaces/:id/archive | Accept ids (session ID array) and archived (boolean); archive or restore the selection; return 204 |
| DELETE /api/workspaces/:id/archive | Accept ids; permanently delete only the selected archived chats; return 204 |
| DELETE /api/workspaces/:id/sessions/:sessionId | Permanently delete one chat belonging to the project, archived or unarchived; return 204 |

path must be an absolute directory. Registration resolves it with realpath and checks read/traversal permissions. The same directory or a symlink to it reuses the existing project. The default display name comes from the directory name. Listings retain unavailable directories with accessible set to false.

## Persistence and Concurrency

ProjectStore saves the project array to `<agentDir>/web-ui/projects.json`. Writes are serialized within the process, using a temporary sibling file and atomic replacement. Invalid content reports an error rather than being overwritten with an empty list.

SessionRegistry guards removal. Pending loading/creation, an active session, or unsaved history returns project_busy (409). New session operations are blocked during removal. Success disposes instances and clears sessionId-to-workspaceId mappings. Registering the same directory again exposes its existing SDK sessions.

Archive and restore use the same project exclusion guard. Every ID must belong to the project; an unknown ID returns session_not_found (404) without changing the archive. The request contains the exact IDs shown in the confirmation, so newly created chats are not silently included. GET /api/sessions?workspaceId=… returns unarchived chats with user messages, including live first runs; add archived=true to list archived chats, including older empty archives. Drafts without user messages are excluded from project archive selections. Direct session reads still work for archived IDs. Archived chats retain their history, titles, attachments and IDs; no model call is made by archiving or restoring.

The public coding-agent [SessionArchive](../../../coding-agent/docs/session-archive.md) stores membership beside project history. It is independent of project registration, so removing and re-adding a directory retains archive membership. The Web bridge reuses one archive writer per canonical history directory. Invalid metadata or write failures reject without replacing history or partially archiving a batch.

Archive deletion uses the same busy-project guard. It rejects missing, foreign or unarchived IDs with session_not_archived (409) before deleting any selected history. Title work is drained first; cached controllers for deleted IDs are disposed so later saves cannot recreate deleted files. Project files and unselected history remain. Web submits each confirmed project's exact selection separately; an error stops later projects, refreshes lists, and leaves already completed projects deleted. See the SDK archive page for staging, rollback and crash limitations.

## Directory Selection API

Single-chat deletion uses the same lifecycle guard and staging operation as archive deletion, with no prerequisite archive step. Missing or foreign IDs return session_not_found (404). The endpoint never accepts a history file path and never deletes project files. Successful deletion drains title writes and disposes any loaded controller before releasing the project guard. Confirmation is owned by the Web UI.

| Endpoint | Behavior |
| --- | --- |
| GET /api/directories/capabilities | Return native and preferred |
| GET /api/directories?path=… | Return canonical path, parent, home, immediate subdirectories, and truncated |
| POST /api/directories/pick | Return the system-selected path, or null on cancellation |

Browsing starts at the home directory if no path is supplied. Entries are sorted by name and include directories or symlinks to directories. At most 1000 candidates are inspected; larger listings set truncated. Missing or unreadable paths report directory_unreadable.

Native selection supports only non-SSH macOS environments, with one window at a time. Request cancellation reaches the picker process; user cancellation is not an error. Other environments use browser-based directory navigation.

## Boundaries

Directory browsing accesses the server's local filesystem; it is not file upload or remote file management. A registered directory is the tools' working directory, not a security sandbox. Session APIs accept project/session IDs, not arbitrary session file paths. Storage has no cross-process write lock; CLI and Web should not write the same session simultaneously.

## Source and Tests

- [Project routes](../routes/projects.ts) / [HTTP tests](../router.test.ts).
- [ProjectStore](../projects/project-store.ts) / [tests](../projects/project-store.test.ts).
- [SessionRegistry](../session-registry.ts) / [removal and load-race tests](../session-registry.test.ts).
- [Directory browsing](../directories/browse.ts) / [tests](../directories/browse.test.ts).
- [Native picker](../directories/native-picker.ts) / [tests](../directories/native-picker.test.ts).
